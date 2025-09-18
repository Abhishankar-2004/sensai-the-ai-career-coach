import { NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import pdfParse from "pdf-parse";
import mammoth from "mammoth";

async function extractTextFromPDF(file) {
  const arrayBuffer = await file.arrayBuffer();
  const buffer = Buffer.from(arrayBuffer);
  const data = await pdfParse(buffer);
  return data.text;
}

async function extractTextFromDoc(file) {
  const arrayBuffer = await file.arrayBuffer();
  const { value } = await mammoth.extractRawText({ buffer: arrayBuffer });
  return value;
}

async function extractTextFromTxt(file) {
  return await file.text();
}

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
    const fileName = file.name ? file.name.toLowerCase() : "";

    if (fileType === "application/pdf" || fileName.endsWith(".pdf")) {
      text = await extractTextFromPDF(file);
    } else if (
      fileType === "application/msword" ||
      fileType === "application/vnd.openxmlformats-officedocument.wordprocessingml.document" ||
      fileName.endsWith(".doc") ||
      fileName.endsWith(".docx")
    ) {
      text = await extractTextFromDoc(file);
    } else if (fileType === "text/plain" || fileName.endsWith(".txt")) {
      text = await extractTextFromTxt(file);
    } else {
      return new NextResponse(
        "Unsupported file type. Please upload a PDF, Word, or TXT document.",
        { status: 400 }
      );
    }

    if (!text || text.trim().length === 0) {
      return new NextResponse(
        "Could not extract any text from the file. It might be empty or image-based.",
        { status: 400 }
      );
    }

    return NextResponse.json({ text });

  } catch (error) {
    console.error("Error parsing JD file:", error);
    return new NextResponse("Internal Server Error", { status: 500 });
  }
}