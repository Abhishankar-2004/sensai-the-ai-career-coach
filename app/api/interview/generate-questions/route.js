import { NextResponse } from "next/server";
import { generateContentWithRetry, handleGeminiError } from "@/lib/gemini-utils";

export async function POST(req) {
  try {
    const { jobDescription, numQuestions = 5, questionTypes = ["technical", "behavioral", "situational"] } = await req.json();
    if (!jobDescription || !jobDescription.trim()) {
      return new NextResponse("Job description is required.", { status: 400 });
    }
    const prompt = `
      Based on the following job description, generate ${numQuestions} interview questions.
      The questions should be a mix of the following types: ${questionTypes.join(", ")}.
      For each question, specify its type (technical, behavioral, or situational).
      The questions should be directly related to the skills and qualifications mentioned in the job description.
      Return the result as a JSON array of objects with fields: question, type.

      Job Description:
      ${jobDescription}
    `;
    const result = await generateContentWithRetry(prompt, "gemini-1.5-pro");
    const response = result.response;
    const responseText = response.text();
    const jsonMatch = responseText.match(/\[.*\]/s);
    if (!jsonMatch) {
      return new NextResponse("Failed to parse questions from AI response.", { status: 500 });
    }
    const questions = JSON.parse(jsonMatch[0]);
    return NextResponse.json({ questions });
  } catch (error) {
    const errorInfo = handleGeminiError(error);
    return new NextResponse(errorInfo.message, { status: errorInfo.status });
  }
}
