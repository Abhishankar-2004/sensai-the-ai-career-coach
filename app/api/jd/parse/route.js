import { NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";

export const runtime = "nodejs";

// Clean and normalize text
function cleanJobDescriptionText(text) {
  return text
    .replace(/\r\n|\r|\n/g, '\n')
    .replace(/[ \t]+/g, ' ')
    .replace(/\n{2,}/g, '\n\n')
    .replace(/[^\x20-\x7E\n]/g, '')
    .trim();
}

async function extractTextFromPDF(file) {
  try {
    console.log("Starting PDF extraction for job description");
    
    const fileSize = file.size;
    if (fileSize === 0) {
      throw new Error("File is empty");
    }
    if (fileSize > 10 * 1024 * 1024) {
      throw new Error("File is too large. Maximum size is 10MB");
    }
    
    const arrayBuffer = await file.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);
    
    // Basic PDF validation
    const pdfHeader = buffer.slice(0, 4).toString();
    if (pdfHeader !== '%PDF') {
      throw new Error("Invalid PDF file format");
    }
    
    // Try pdf-parse first
    try {
      const pdf = (await import("pdf-parse")).default;
      const data = await pdf(buffer);
      if (data.text && data.text.trim().length > 0) {
        console.log("pdf-parse successful, extracted text length:", data.text.length);
        return data.text;
      }
    } catch (pdfParseError) {
      console.warn("pdf-parse failed:", pdfParseError.message);
    }
    
    // Fallback to pdf2json
    try {
      const PDFParser = (await import("pdf2json")).default;
      const pdfParser = new PDFParser();
      
      const parsePromise = new Promise((resolve, reject) => {
        const timeout = setTimeout(() => {
          reject(new Error("PDF parsing timeout"));
        }, 15000);
        
        pdfParser.on("pdfParser_dataError", (errData) => {
          clearTimeout(timeout);
          reject(new Error(`PDF parsing error: ${errData.parserError}`));
        });
        
        pdfParser.on("pdfParser_dataReady", (pdfData) => {
          clearTimeout(timeout);
          try {
            let text = '';
            if (pdfData && pdfData.Pages) {
              for (const page of pdfData.Pages) {
                if (page.Texts) {
                  for (const textItem of page.Texts) {
                    if (textItem.R) {
                      for (const run of textItem.R) {
                        if (run.T) {
                          try {
                            text += decodeURIComponent(run.T) + ' ';
                          } catch {
                            text += run.T + ' ';
                          }
                        }
                      }
                    }
                  }
                  text += '\n';
                }
              }
            }
            resolve(text.trim());
          } catch (extractError) {
            reject(new Error(`Text extraction error: ${extractError.message}`));
          }
        });
      });
      
      pdfParser.parseBuffer(buffer);
      const text = await parsePromise;
      
      if (text && text.trim().length > 0) {
        console.log("pdf2json successful, extracted text length:", text.length);
        return text;
      }
    } catch (pdf2jsonError) {
      console.warn("pdf2json failed:", pdf2jsonError.message);
    }
    
    throw new Error("Could not extract text from PDF. Please try a different file format.");
  } catch (error) {
    console.error("PDF extraction error:", error);
    throw error;
  }
}

async function extractTextFromDoc(file) {
  try {
    console.log("Starting DOC extraction for job description");
    
    const mammoth = await import("mammoth");
    
    const fileSize = file.size;
    if (fileSize === 0) {
      throw new Error("File is empty");
    }
    if (fileSize > 10 * 1024 * 1024) {
      throw new Error("File is too large. Maximum size is 10MB");
    }
    
    const arrayBuffer = await file.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);
    
    // Try raw text extraction first
    try {
      const rawResult = await mammoth.extractRawText({ buffer });
      if (rawResult && rawResult.value && rawResult.value.trim().length > 0) {
        console.log("Raw text extraction successful, length:", rawResult.value.length);
        return rawResult.value;
      }
    } catch (rawError) {
      console.warn("Raw text extraction failed:", rawError.message);
    }
    
    // Fallback to HTML extraction
    try {
      const htmlResult = await mammoth.convertToHtml({ buffer });
      if (htmlResult && htmlResult.value) {
        const htmlText = htmlResult.value
          .replace(/<[^>]*>/g, ' ')
          .replace(/&nbsp;/g, ' ')
          .replace(/&amp;/g, '&')
          .replace(/&lt;/g, '<')
          .replace(/&gt;/g, '>')
          .replace(/&quot;/g, '"')
          .replace(/&#39;/g, "'")
          .replace(/\s+/g, ' ')
          .trim();
        
        if (htmlText.length > 0) {
          console.log("HTML extraction successful, length:", htmlText.length);
          return htmlText;
        }
      }
    } catch (htmlError) {
      console.warn("HTML extraction failed:", htmlError.message);
    }
    
    throw new Error("Could not extract text from document");
  } catch (error) {
    console.error("DOC extraction error:", error);
    throw error;
  }
}

export async function POST(request) {
  try {
    console.log("Job description parse API called");
    
    const { userId } = await auth();
    if (!userId) {
      console.error("Unauthorized access attempt");
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const formData = await request.formData();
    const file = formData.get("file");

    if (!file) {
      console.error("No file provided");
      return NextResponse.json({ error: "No file provided" }, { status: 400 });
    }

    console.log("File received:", file.name, file.type, file.size);

    let text = "";
    const fileType = file.type;
    const fileName = file.name ? file.name.toLowerCase() : "";

    try {
      // Parse based on file type
      if (fileType === "application/pdf" || fileName.endsWith(".pdf")) {
        text = await extractTextFromPDF(file);
      } else if (
        fileType === "application/vnd.openxmlformats-officedocument.wordprocessingml.document" ||
        fileType === "application/msword" ||
        fileName.endsWith(".docx") ||
        fileName.endsWith(".doc")
      ) {
        text = await extractTextFromDoc(file);
      } else if (fileType === "text/plain" || fileName.endsWith(".txt")) {
        const buffer = Buffer.from(await file.arrayBuffer());
        text = buffer.toString("utf-8");
      } else {
        console.error("Unsupported file type:", fileType);
        return NextResponse.json(
          { error: "Unsupported file type. Please upload PDF, DOCX, DOC, or TXT files." },
          { status: 400 }
        );
      }
    } catch (extractionError) {
      console.error("Text extraction failed:", extractionError);
      return NextResponse.json(
        { error: `Failed to extract text: ${extractionError.message}` },
        { status: 400 }
      );
    }

    // Clean up the text
    const cleanedText = cleanJobDescriptionText(text);

    console.log("Extracted text length:", cleanedText.length);
    console.log("Text preview:", cleanedText.substring(0, 200));

    if (!cleanedText || cleanedText.length < 20) {
      return NextResponse.json(
        { error: "Could not extract meaningful text from the file. Please check the file content." },
        { status: 400 }
      );
    }

    return NextResponse.json({ jobDescription: cleanedText });
  } catch (error) {
    console.error("Error parsing job description file:", error);
    return NextResponse.json(
      { error: "Failed to parse the file. Please try again." },
      { status: 500 }
    );
  }
}