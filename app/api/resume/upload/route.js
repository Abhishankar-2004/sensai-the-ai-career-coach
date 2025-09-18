import { NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { generateContentWithRetry, handleGeminiError } from "@/lib/gemini-utils";

export const runtime = "nodejs";

// Clean and normalize resume text for better AI parsing
function cleanResumeText(text) {
  return text
    .replace(/\r\n|\r|\n/g, '\n') // Normalize line breaks
    .replace(/[ \t]+/g, ' ')         // Remove extra spaces/tabs
    .replace(/\n{2,}/g, '\n\n')    // Limit consecutive newlines
    .replace(/[^\x20-\x7E\n]/g, '') // Remove non-printable chars
    .trim();
}

// Enhanced fallback parsing when AI fails
function parseResumeBasic(text) {
  const lines = text.split('\n').filter(line => line.trim().length > 0);
  
  // Try to extract basic information with better patterns
  const emailMatch = text.match(/[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/);
  const phoneMatch = text.match(/[\+]?[1-9]?[\d\s\-\(\)\.]{10,}/);
  const linkedinMatch = text.match(/(?:linkedin\.com\/in\/|linkedin\.com\/profile\/view\?id=)([a-zA-Z0-9\-]+)/i);
  
  // Try to find name (usually in first few lines)
  let nameMatch = null;
  for (let i = 0; i < Math.min(5, lines.length); i++) {
    const line = lines[i].trim();
    // Look for lines that might be names (2-4 words, mostly letters)
    if (line.match(/^[A-Za-z\s]{2,50}$/) && line.split(' ').length >= 2 && line.split(' ').length <= 4) {
      nameMatch = line;
      break;
    }
  }
  
  // Extract skills by looking for common skill-related keywords
  const skillKeywords = ['skills', 'technologies', 'programming', 'languages', 'tools', 'software'];
  let skillsText = '';
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].toLowerCase();
    if (skillKeywords.some(keyword => line.includes(keyword))) {
      // Take this line and the next few lines as potential skills
      skillsText = lines.slice(i, i + 3).join(' ');
      break;
    }
  }
  
  // Create a more comprehensive basic structure
  return {
    contactInfo: {
      name: nameMatch || '',
      email: emailMatch ? emailMatch[0] : '',
      mobile: phoneMatch ? phoneMatch[0] : '',
      linkedin: linkedinMatch ? `https://linkedin.com/in/${linkedinMatch[1]}` : ''
    },
    summary: lines.slice(0, 5).join(' ').substring(0, 500) + (lines.length > 5 ? '...' : ''),
    skills: skillsText || "Please review and update your skills section based on the content below",
    experience: [],
    education: [],
    projects: [],
    certifications: [],
    achievements: []
  };
}

export async function POST(req) {
  try {
    const { userId } = await auth();
    if (!userId) {
      console.error("Unauthorized access attempt to /api/resume/upload");
      return new NextResponse("Unauthorized", { status: 401 });
    }

    const formData = await req.formData();
    const file = formData.get("file");
    
    if (!file) {
      console.error("No file provided in upload request");
      return new NextResponse("No file provided", { status: 400 });
    }

    let text = "";
    const fileType = file.type;
    const fileName = file.name ? file.name.toLowerCase() : "";

    console.log("File type:", fileType);
    console.log("File name:", fileName);

    try {
      // Check file type by both MIME type and file extension
      if (fileType === "application/pdf" || fileName.endsWith(".pdf")) {
        console.log("Processing PDF file:", fileName);
        text = await extractTextFromPDF(file);
      } else if (
        fileType === "application/msword" || 
        fileType === "application/vnd.openxmlformats-officedocument.wordprocessingml.document" ||
        fileName.endsWith(".doc") || 
        fileName.endsWith(".docx")
      ) {
        console.log("Processing Word document:", fileName);
        text = await extractTextFromDoc(file);
      } else {
        console.error("Unsupported file type:", fileType, "for file:", fileName);
        return new NextResponse("Unsupported file type. Please upload a PDF or Word document (.pdf, .doc, .docx).", { status: 400 });
      }
    } catch (error) {
      console.error("Error extracting text from file:", error);
      return new NextResponse(`Failed to extract text from file: ${error.message}`, { status: 500 });
    }

    if (!text || text.trim().length === 0) {
      console.error("No text could be extracted from the file");
      return new NextResponse("No text could be extracted from the file. The file may be empty, corrupted, or contain only images.", { status: 400 });
    }

    // Clean the extracted text before sending to AI
    const cleanedText = cleanResumeText(text);

    console.log("Extracted text length:", cleanedText.length);

    // Use AI to parse and structure the resume content
    const prompt = `
      You are an expert resume parser. Carefully analyze the following resume text and extract ALL relevant information into a structured format. 
      
      IMPORTANT INSTRUCTIONS:
      1. Extract ALL work experience entries, not just the most recent ones
      2. Include ALL education entries (degrees, certifications, courses)
      3. Capture ALL projects mentioned
      4. Extract ALL skills mentioned (technical, soft skills, tools, technologies)
      5. Create a comprehensive professional summary that captures the person's background
      6. Include ALL relevant details like dates, locations, achievements
      7. If information is missing (like dates), use "Not specified" rather than omitting the entry
      8. Preserve the original content as much as possible while structuring it

      Resume text:
      ${cleanedText}

      Return ONLY a valid JSON object in this exact format (no additional text, markdown, or formatting):
      {
        "contactInfo": {
          "name": "full name if found",
          "email": "email if found",
          "mobile": "phone number if found",
          "linkedin": "linkedin profile if found",
          "location": "location/address if found"
        },
        "summary": "comprehensive professional summary (3-5 sentences) that captures the person's background, experience level, and key strengths",
        "skills": "comprehensive comma-separated list of ALL skills, technologies, tools, programming languages, certifications mentioned",
        "experience": [
          {
            "company": "company name",
            "position": "job title/position",
            "location": "location if mentioned",
            "startDate": "start date or 'Not specified'",
            "endDate": "end date or 'Present' or 'Not specified'",
            "description": "detailed description of responsibilities, achievements, and key accomplishments"
          }
        ],
        "education": [
          {
            "institution": "school/university name",
            "degree": "degree name, major, or certification",
            "location": "location if mentioned",
            "startDate": "start date or 'Not specified'",
            "endDate": "end date or 'Not specified'",
            "gpa": "GPA if mentioned",
            "description": "additional details, honors, relevant coursework"
          }
        ],
        "projects": [
          {
            "name": "project name",
            "role": "role in project if mentioned",
            "startDate": "start date or 'Not specified'",
            "endDate": "end date or 'Not specified'",
            "technologies": "technologies used if mentioned",
            "description": "detailed project description, objectives, and outcomes"
          }
        ],
        "certifications": [
          {
            "name": "certification name",
            "issuer": "issuing organization",
            "date": "date obtained or 'Not specified'",
            "description": "additional details if any"
          }
        ],
        "achievements": [
          "list of notable achievements, awards, or recognitions mentioned"
        ]
      }
    `;

    try {
      console.log("Sending prompt to AI model");
      const result = await generateContentWithRetry(prompt, "gemini-1.5-flash");
      const response = result.response;
      const responseText = response.text();
      
      console.log("AI response received, length:", responseText.length);
      
      let parsedContent;
      try {
        // Try to find JSON content within the response
        const jsonMatch = responseText.match(/\{[\s\S]*\}/);
        if (!jsonMatch) {
          console.error("No JSON found in response:", responseText);
          // Fallback: create a basic structure with the raw text
          parsedContent = {
            summary: cleanedText.substring(0, 500) + "...",
            skills: "Skills extracted from resume",
            experience: [],
            education: [],
            projects: []
          };
        } else {
          parsedContent = JSON.parse(jsonMatch[0]);
        }
        
        // Validate and ensure all required fields are present with defaults
        if (!parsedContent || typeof parsedContent !== 'object') {
          parsedContent = {};
        }
        
        // Ensure all fields exist with proper defaults
        parsedContent.contactInfo = parsedContent.contactInfo || {};
        parsedContent.summary = parsedContent.summary || cleanedText.substring(0, 500) + "...";
        parsedContent.skills = parsedContent.skills || "Skills extracted from resume";
        parsedContent.experience = Array.isArray(parsedContent.experience) ? parsedContent.experience : [];
        parsedContent.education = Array.isArray(parsedContent.education) ? parsedContent.education : [];
        parsedContent.projects = Array.isArray(parsedContent.projects) ? parsedContent.projects : [];
        parsedContent.certifications = Array.isArray(parsedContent.certifications) ? parsedContent.certifications : [];
        parsedContent.achievements = Array.isArray(parsedContent.achievements) ? parsedContent.achievements : [];
        
        // Log extracted content summary for debugging
        console.log("Extracted content summary:");
        console.log("- Contact info:", Object.keys(parsedContent.contactInfo).length, "fields");
        console.log("- Summary length:", parsedContent.summary.length);
        console.log("- Skills length:", parsedContent.skills.length);
        console.log("- Experience entries:", parsedContent.experience.length);
        console.log("- Education entries:", parsedContent.education.length);
        console.log("- Project entries:", parsedContent.projects.length);
        console.log("- Certifications:", parsedContent.certifications.length);
        console.log("- Achievements:", parsedContent.achievements.length);
        
        console.log("Successfully parsed AI response");
        return NextResponse.json({ content: parsedContent });
        
      } catch (parseError) {
        console.error("Error parsing AI response:", parseError);
        // Fallback: return basic structure with extracted text
        const fallbackContent = parseResumeBasic(cleanedText);
        return NextResponse.json({ content: fallbackContent });
      }
    } catch (error) {
      console.error("Error parsing resume with AI:", error);
      const errorInfo = handleGeminiError(error);
      
      // If AI fails, return basic structure with extracted text
      if (errorInfo.status >= 500) {
        const fallbackContent = parseResumeBasic(cleanedText);
        return NextResponse.json({ content: fallbackContent });
      }
      
      return new NextResponse(errorInfo.message, { status: errorInfo.status });
    }
  } catch (error) {
    console.error("Resume upload error (outer catch):", error);
    return new NextResponse(error.message || "Internal Server Error", { status: 500 });
  }
}

async function extractTextFromPDF(file) {
  try {
    console.log("Starting PDF extraction");
    
    // Validate file size
    const fileSize = file.size;
    if (fileSize === 0) {
      throw new Error("File is empty");
    }
    if (fileSize > 10 * 1024 * 1024) { // 10MB limit
      throw new Error("File is too large. Maximum size is 10MB");
    }
    
    // Get array buffer from file
    const arrayBuffer = await file.arrayBuffer();
    if (!arrayBuffer || arrayBuffer.byteLength === 0) {
      throw new Error("Failed to read file contents");
    }
    
    const buffer = Buffer.from(arrayBuffer);
    console.log("Buffer created, size:", buffer.length);
    
    // Basic PDF validation - check for PDF header
    const pdfHeader = buffer.slice(0, 4).toString();
    if (pdfHeader !== '%PDF') {
      throw new Error("Invalid PDF file format");
    }
    
    // Try multiple PDF parsing approaches
    let extractedText = null;
    
    // First try: pdf2json library (more reliable)
    try {
      console.log("Trying pdf2json library");
      const PDFParser = (await import("pdf2json")).default;
      
      const pdfParser = new PDFParser();
      
      // Create a promise to handle the async parsing
      const parsePromise = new Promise((resolve, reject) => {
        pdfParser.on("pdfParser_dataError", (errData) => {
          reject(new Error(`PDF parsing error: ${errData.parserError}`));
        });
        
        pdfParser.on("pdfParser_dataReady", (pdfData) => {
          try {
            // Extract text from parsed PDF data
            let text = '';
            console.log("PDF data structure:", JSON.stringify(pdfData, null, 2).substring(0, 500) + "...");
            
            if (pdfData && pdfData.Pages) {
              console.log(`Found ${pdfData.Pages.length} pages`);
              
              for (let pageIndex = 0; pageIndex < pdfData.Pages.length; pageIndex++) {
                const page = pdfData.Pages[pageIndex];
                console.log(`Processing page ${pageIndex + 1}`);
                
                if (page.Texts && page.Texts.length > 0) {
                  console.log(`Found ${page.Texts.length} text items on page ${pageIndex + 1}`);
                  
                  for (const textItem of page.Texts) {
                    if (textItem.R && textItem.R.length > 0) {
                      for (const run of textItem.R) {
                        if (run.T) {
                          try {
                            const decodedText = decodeURIComponent(run.T);
                            text += decodedText + ' ';
                          } catch (decodeError) {
                            // If decoding fails, use the raw text
                            text += run.T + ' ';
                          }
                        }
                      }
                    }
                  }
                  text += '\n';
                } else {
                  console.log(`No text items found on page ${pageIndex + 1}`);
                }
              }
            } else {
              console.log("No pages found in PDF data");
            }
            
            console.log(`Extracted text length: ${text.trim().length}`);
            console.log(`First 200 chars: ${text.trim().substring(0, 200)}`);
            
            resolve(text.trim());
          } catch (extractError) {
            console.error("Text extraction error:", extractError);
            reject(new Error(`Text extraction error: ${extractError.message}`));
          }
        });
        
        // Set a timeout for parsing
        setTimeout(() => {
          reject(new Error("PDF parsing timeout"));
        }, 30000); // 30 second timeout
      });
      
      // Parse the buffer
      pdfParser.parseBuffer(buffer);
      
      const text = await parsePromise;
      if (text && text.trim().length > 0) {
        extractedText = text.replace(/\s+/g, ' ').trim();
        console.log("pdf2json successful, extracted text length:", extractedText.length);
      }
    } catch (pdf2jsonError) {
      console.warn("pdf2json failed:", pdf2jsonError.message);
    }
    
    // Second try: Alternative approach if pdf2json didn't extract text
    if (!extractedText) {
      console.log("pdf2json didn't extract text, trying alternative approach");
      
      // For PDFs that don't have extractable text (like scanned documents),
      // we'll provide a helpful error message
      console.log("No text could be extracted from PDF - may be image-based or protected");
    }
    
    if (!extractedText || extractedText.trim().length === 0) {
      // Instead of throwing an error, provide a helpful message and suggest alternatives
      console.log("No text extracted from PDF, providing user guidance");
      throw new Error("This PDF appears to be image-based or in a format that cannot be processed automatically. Please try:\n\n1. Converting your PDF to a Word document (.docx)\n2. Using a different PDF that contains selectable text\n3. Manually entering your resume information using the form below\n\nWord documents (.docx) work reliably with our system.");
    }
    
    return extractedText;
  } catch (error) {
    console.error("PDF extraction error:", error);
    
    // Provide more specific error messages
    if (error.message.includes('ENOENT') && error.message.includes('test/data')) {
      throw new Error("PDF parsing library error detected. Please try uploading a different PDF file or use a Word document (.doc/.docx) instead.");
    }
    
    throw new Error(`Failed to process PDF file: ${error.message}`);
  }
}

async function extractTextFromDoc(file) {
  try {
    console.log("Starting DOC extraction");
    
    // Dynamic import to avoid build-time issues
    const mammoth = await import("mammoth");
    
    // Validate file size
    const fileSize = file.size;
    if (fileSize === 0) {
      throw new Error("File is empty");
    }
    if (fileSize > 10 * 1024 * 1024) { // 10MB limit
      throw new Error("File is too large. Maximum size is 10MB");
    }
    
    const arrayBuffer = await file.arrayBuffer();
    if (!arrayBuffer || arrayBuffer.byteLength === 0) {
      throw new Error("Failed to read file contents");
    }
    
    const buffer = Buffer.from(arrayBuffer);
    console.log("Buffer created, size:", buffer.length);
    
    // Try multiple extraction methods for better content capture
    let extractedText = '';
    
    // Method 1: Extract raw text (preserves structure better)
    try {
      console.log("Trying raw text extraction");
      const rawResult = await mammoth.extractRawText({ buffer });
      if (rawResult && rawResult.value) {
        extractedText = rawResult.value;
        console.log("Raw text extraction successful, length:", extractedText.length);
      }
    } catch (rawError) {
      console.warn("Raw text extraction failed:", rawError.message);
    }
    
    // Method 2: If raw text is insufficient, try HTML extraction and convert
    if (!extractedText || extractedText.trim().length < 100) {
      try {
        console.log("Trying HTML extraction as fallback");
        const htmlResult = await mammoth.convertToHtml({ buffer });
        if (htmlResult && htmlResult.value) {
          // Strip HTML tags to get plain text
          const htmlText = htmlResult.value
            .replace(/<[^>]*>/g, ' ')  // Remove HTML tags
            .replace(/&nbsp;/g, ' ')   // Replace non-breaking spaces
            .replace(/&amp;/g, '&')    // Replace HTML entities
            .replace(/&lt;/g, '<')
            .replace(/&gt;/g, '>')
            .replace(/&quot;/g, '"')
            .replace(/&#39;/g, "'")
            .replace(/\s+/g, ' ')      // Normalize whitespace
            .trim();
          
          if (htmlText.length > extractedText.length) {
            extractedText = htmlText;
            console.log("HTML extraction provided better results, length:", extractedText.length);
          }
        }
      } catch (htmlError) {
        console.warn("HTML extraction failed:", htmlError.message);
      }
    }
    
    if (!extractedText || extractedText.trim().length === 0) {
      throw new Error("No text content found in document");
    }
    
    // Log first 500 characters for debugging
    console.log("DOC extraction completed, text length:", extractedText.length);
    console.log("First 500 chars:", extractedText.substring(0, 500));
    
    return extractedText.trim();
  } catch (error) {
    console.error("DOC extraction error:", error);
    throw new Error(`Failed to process Word document: ${error.message}`);
  }
}