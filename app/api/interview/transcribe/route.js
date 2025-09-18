import { NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { GoogleGenerativeAI } from "@google/generative-ai";

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);

export async function POST(request) {
  try {
    const { userId } = await auth();
    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const formData = await request.formData();
    const audioFile = formData.get("audio");

    if (!audioFile) {
      return NextResponse.json({ error: "No audio file provided" }, { status: 400 });
    }

    // Convert audio file to base64
    const bytes = await audioFile.arrayBuffer();
    const buffer = Buffer.from(bytes);
    const base64Audio = buffer.toString('base64');

    // Use Gemini for audio transcription
    const model = genAI.getGenerativeModel({ model: "gemini-1.5-pro" });
    
    const result = await model.generateContent([
      {
        inlineData: {
          mimeType: audioFile.type,
          data: base64Audio
        }
      },
      "Please transcribe this audio file. Return only the transcribed text, no additional formatting or explanations."
    ]);

    const transcription = result.response.text().trim();

    if (!transcription) {
      return NextResponse.json(
        { error: "Could not transcribe the audio. Please try speaking more clearly." },
        { status: 400 }
      );
    }

    return NextResponse.json({ transcription });
  } catch (error) {
    console.error("Error transcribing audio:", error);
    return NextResponse.json(
      { error: "Failed to transcribe audio. Please try again." },
      { status: 500 }
    );
  }
}