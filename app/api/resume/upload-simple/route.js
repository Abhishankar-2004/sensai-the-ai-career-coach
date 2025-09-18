import { NextResponse } from "next/server";

export const runtime = "nodejs";

export async function POST(req) {
  try {
    console.log("Simple resume upload API called");
    
    const formData = await req.formData();
    const file = formData.get("file");
    
    if (!file) {
      console.error("No file provided");
      return new NextResponse("No file provided", { status: 400 });
    }

    console.log("File received:", file.name, file.type, file.size);

    let text = "";
    const fileType = file.type;
    const fileName = file.name ? file.name.toLowerCase() : "";

    try {
      // Dynamic imports to avoid build-time issues
      const pdfParse = (await import("pdf-parse")).default;
      const mammoth = await import("mammoth");
      
      if (fileType === "application/pdf" || fileName.endsWith(".pdf")) {
        console.log("Processing PDF file");
        const arrayBuffer = await file.arrayBuffer();
        const buffer = Buffer.from(arrayBuffer);
        const data = await pdfParse(buffer);
        text = data.text;
      } else if (
        fileType === "application/msword" || 
        fileType === "application/vnd.openxmlformats-officedocument.wordprocessingml.document" ||
        fileName.endsWith(".doc") || 
        fileName.endsWith(".docx")
      ) {
        console.log("Processing Word document");
        const arrayBuffer = await file.arrayBuffer();
        const buffer = Buffer.from(arrayBuffer);
        const result = await mammoth.extractRawText({ buffer });
        text = result.value;
      } else {
        console.log("Unsupported file type:", fileType);
        return new NextResponse("Unsupported file type. Please upload a PDF or Word document.", { status: 400 });
      }
    } catch (error) {
      console.error("Error extracting text:", error);
      return new NextResponse(`Failed to extract text: ${error.message}`, { status: 500 });
    }

    if (!text || text.trim().length === 0) {
      console.error("No text extracted");
      return new NextResponse("No text could be extracted from the file.", { status: 400 });
    }

    console.log("Text extracted successfully, length:", text.length);

    // Return simple structured response without AI processing
    const simpleContent = {
      summary: "Professional summary extracted from resume",
      skills: "Skills extracted from resume",
      experience: [
        {
          company: "Sample Company",
          position: "Sample Position",
          startDate: "2020",
          endDate: "2023",
          description: "Sample job description"
        }
      ],
      education: [
        {
          institution: "Sample University",
          degree: "Sample Degree",
          startDate: "2016",
          endDate: "2020",
          description: "Sample education description"
        }
      ],
      projects: [
        {
          name: "Sample Project",
          startDate: "2022",
          endDate: "2023",
          description: "Sample project description"
        }
      ]
    };

    return NextResponse.json({ content: simpleContent });
  } catch (error) {
    console.error("Simple resume upload error:", error);
    return new NextResponse(error.message || "Internal Server Error", { status: 500 });
  }
}