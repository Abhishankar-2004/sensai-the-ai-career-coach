import { NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { GoogleGenerativeAI } from "@google/generative-ai";
import PDFParser from "pdf2json";
import mammoth from "mammoth";

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
const model = genAI.getGenerativeModel({ model: "gemini-1.5-pro" });

export async function POST(req) {
  try {
    const { userId } = await auth();
    if (!userId) {
      return new NextResponse("Unauthorized", { status: 401 });
    }

    const formData = await req.formData();
    const file = formData.get("file");
    
    if (!file) {
      return new NextResponse("No file provided", { status: 400 });
    }

    let text = "";
    const fileType = file.type;
    const fileName = file.name.toLowerCase();

    console.log("File type:", fileType);
    console.log("File name:", fileName);

    try {
      // Check file type by both MIME type and file extension
      if (fileType === "application/pdf" || fileName.endsWith(".pdf")) {
        text = await extractTextFromPDF(file);
      } else if (
        fileType === "application/msword" || 
        fileType === "application/vnd.openxmlformats-officedocument.wordprocessingml.document" ||
        fileName.endsWith(".doc") || 
        fileName.endsWith(".docx")
      ) {
        text = await extractTextFromDoc(file);
      } else {
        return new NextResponse("Unsupported file type. Please upload a PDF or Word document.", { status: 400 });
      }
    } catch (error) {
      console.error("Error extracting text from file:", error);
      return new NextResponse(`Failed to extract text from file: ${error.message}`, { status: 500 });
    }

    if (!text || text.trim().length === 0) {
      return new NextResponse("No text could be extracted from the file", { status: 400 });
    }

    console.log("Extracted text length:", text.length);

    // Use AI to parse and structure the resume content
    const prompt = `
      Parse the following resume text and extract the following sections in a structured format:
      1. Professional Summary
      2. Skills
      3. Work Experience (with company, position, dates, and description)
      4. Education (with institution, degree, dates, and description)
      5. Projects (with name, dates, and description)

      Resume text:
      ${text}

      Return the parsed content in the following JSON format:
      {
        "summary": "extracted summary",
        "skills": "extracted skills",
        "experience": [
          {
            "company": "company name",
            "position": "position title",
            "startDate": "start date",
            "endDate": "end date",
            "description": "job description"
          }
        ],
        "education": [
          {
            "institution": "institution name",
            "degree": "degree name",
            "startDate": "start date",
            "endDate": "end date",
            "description": "education description"
          }
        ],
        "projects": [
          {
            "name": "project name",
            "startDate": "start date",
            "endDate": "end date",
            "description": "project description"
          }
        ]
      }
    `;

    try {
      console.log("Sending prompt to AI model");
      const result = await model.generateContent(prompt);
      const response = result.response;
      const responseText = response.text();
      console.log("AI response received, length:", responseText.length);
      
      let parsedContent;
      try {
        // Try to find JSON content within the response
        const jsonMatch = responseText.match(/\{[\s\S]*\}/);
        if (!jsonMatch) {
          console.error("No JSON found in response:", responseText);
          throw new Error("Invalid response format from AI");
        }
        
        parsedContent = JSON.parse(jsonMatch[0]);
        
        // Validate the structure of the parsed content
        if (!parsedContent || typeof parsedContent !== 'object') {
          throw new Error("Invalid response format from AI");
        }
        
        // Ensure all required fields are present
        const requiredFields = ['summary', 'skills', 'experience', 'education', 'projects'];
        const missingFields = requiredFields.filter(field => !parsedContent[field]);
        
        if (missingFields.length > 0) {
          console.error("Missing required fields:", missingFields);
          throw new Error(`Missing required fields: ${missingFields.join(', ')}`);
        }
        
        // Ensure arrays are properly formatted
        if (!Array.isArray(parsedContent.experience)) {
          parsedContent.experience = [];
        }
        if (!Array.isArray(parsedContent.education)) {
          parsedContent.education = [];
        }
        if (!Array.isArray(parsedContent.projects)) {
          parsedContent.projects = [];
        }
        
        // Ensure string fields are strings
        if (typeof parsedContent.summary !== 'string') {
          parsedContent.summary = String(parsedContent.summary || '');
        }
        if (typeof parsedContent.skills !== 'string') {
          parsedContent.skills = String(parsedContent.skills || '');
        }
        
        console.log("Successfully parsed AI response");
        return NextResponse.json({ content: parsedContent });
      } catch (parseError) {
        console.error("Error parsing AI response:", parseError);
        console.log("Raw response:", responseText);
        return new NextResponse(`Failed to parse AI response: ${parseError.message}`, { status: 500 });
      }
    } catch (error) {
      console.error("Error parsing resume with AI:", error);
      return new NextResponse(`Failed to parse resume content: ${error.message}`, { status: 500 });
    }
  } catch (error) {
    console.error("Resume upload error:", error);
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
    
    // Create a new promise for PDF parsing with timeout
    return new Promise((resolve, reject) => {
      const timeout = setTimeout(() => {
        reject(new Error("PDF parsing timed out"));
      }, 30000); // 30 second timeout
      
      const pdfParser = new PDFParser(null, 1); // 1 = processing PDF
      
      pdfParser.on("pdfParser_dataReady", (pdfData) => {
        clearTimeout(timeout);
        console.log("PDF parsing completed");
        
        try {
          const text = pdfParser.getRawTextContent();
          
          // Validate extracted text
          if (!text || text.trim().length === 0) {
            reject(new Error("No text content found in PDF"));
            return;
          }
          
          console.log("Extracted text length:", text.length);
          resolve(text);
        } catch (error) {
          reject(new Error(`Failed to extract text from PDF: ${error.message}`));
        }
      });
      
      pdfParser.on("pdfParser_dataError", (error) => {
        clearTimeout(timeout);
        console.error("PDF parsing error:", error);
        reject(new Error(`PDF parsing failed: ${error.message || 'Unknown error'}`));
      });
      
      try {
        console.log("Starting PDF parsing");
        pdfParser.parseBuffer(buffer);
      } catch (error) {
        clearTimeout(timeout);
        reject(new Error(`Failed to parse PDF buffer: ${error.message}`));
      }
    });
  } catch (error) {
    console.error("PDF extraction error:", error);
    throw new Error(`Failed to process PDF file: ${error.message}`);
  }
}

async function extractTextFromDoc(file) {
  try {
    console.log("Starting DOC extraction");
    
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
    
    const result = await mammoth.extractRawText({ buffer });
    if (!result || !result.value) {
      throw new Error("Failed to extract text from document");
    }
    
    const text = result.value.trim();
    if (text.length === 0) {
      throw new Error("No text content found in document");
    }
    
    console.log("DOC extraction completed, text length:", text.length);
    return text;
  } catch (error) {
    console.error("DOC extraction error:", error);
    throw new Error(`Failed to process Word document: ${error.message}`);
  }
} 