import { NextResponse } from "next/server";

export const runtime = "nodejs";

export async function POST(request) {
  try {
    console.log("Parse test API called");
    
    // Dynamic imports to avoid build-time issues
    const pdf = (await import("pdf-parse")).default;
    const mammoth = await import("mammoth");
    
    const formData = await request.formData();
    const file = formData.get("file");

    if (!file) {
      console.log("No file provided");
      return NextResponse.json({ error: "No file provided" }, { status: 400 });
    }

    console.log("File received:", file.name, file.type, file.size);

    const buffer = Buffer.from(await file.arrayBuffer());
    let text = "";

    // Parse based on file type
    if (file.type === "application/pdf") {
      console.log("Parsing PDF");
      const data = await pdf(buffer);
      text = data.text;
    } else if (
      file.type === "application/vnd.openxmlformats-officedocument.wordprocessingml.document" ||
      file.type === "application/msword"
    ) {
      console.log("Parsing Word document");
      const result = await mammoth.extractRawText({ buffer });
      text = result.value;
    } else if (file.type === "text/plain") {
      console.log("Parsing text file");
      text = buffer.toString("utf-8");
    } else {
      console.log("Unsupported file type:", file.type);
      return NextResponse.json(
        { error: "Unsupported file type. Please upload PDF, DOCX, DOC, or TXT files." },
        { status: 400 }
      );
    }

    // Clean up the text
    text = text
      .replace(/\s+/g, " ")
      .replace(/\n+/g, "\n")
      .trim();

    console.log("Extracted text length:", text.length);
    console.log("Text preview:", text.substring(0, 200));

    if (!text || text.length < 10) { // Reduced minimum length for testing
      return NextResponse.json(
        { error: "Could not extract meaningful text from the file. Please check the file content." },
        { status: 400 }
      );
    }

    return NextResponse.json({ jobDescription: text });
  } catch (error) {
    console.error("Error parsing job description file:", error);
    return NextResponse.json(
      { error: "Failed to parse the file. Please try again." },
      { status: 500 }
    );
  }
}