"use server";

import { db } from "@/lib/prisma";
import { auth } from "@clerk/nextjs/server";
import { revalidatePath } from "next/cache";
import { GoogleGenerativeAI } from "@google/generative-ai";

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
const model = genAI.getGenerativeModel({ model: "gemini-1.5-pro" });

export async function generateQuiz() {
  const { userId } = await auth();
  if (!userId) throw new Error("Unauthorized");

  const user = await db.user.findUnique({
    where: { clerkUserId: userId },
    select: {
      industry: true,
      skills: true,
    },
  });

  if (!user) throw new Error("User not found");

  const prompt = `
    Generate 10 technical interview questions for a ${
      user.industry
    } professional${
    user.skills?.length ? ` with expertise in ${user.skills.join(", ")}` : ""
  }.
    
    Each question should be multiple choice with 4 options.
    
    Return the response in this JSON format only, no additional text:
    {
      "questions": [
        {
          "question": "string",
          "options": ["string", "string", "string", "string"],
          "correctAnswer": "string",
          "explanation": "string"
        }
      ]
    }
  `;

  try {
    const result = await model.generateContent(prompt);
    const response = result.response;
    const text = response.text();
    
    // Clean up the response text
    const cleanedText = text
      .replace(/```json\n?/g, '')
      .replace(/```\n?/g, '')
      .trim();
    
    // Parse the JSON response
    const quiz = JSON.parse(cleanedText);
    
    // Validate the response structure
    if (!quiz.questions || !Array.isArray(quiz.questions)) {
      throw new Error("Invalid quiz format received");
    }

    // Validate each question
    const validatedQuestions = quiz.questions.map((q, index) => {
      if (!q.question || !q.options || !q.correctAnswer || !q.explanation) {
        throw new Error(`Invalid question format at index ${index}`);
      }
      if (!Array.isArray(q.options) || q.options.length !== 4) {
        throw new Error(`Question ${index + 1} must have exactly 4 options`);
      }
      if (!q.options.includes(q.correctAnswer)) {
        throw new Error(`Correct answer for question ${index + 1} must be one of the options`);
      }
      return q;
    });

    return validatedQuestions;
  } catch (error) {
    console.error("Error generating quiz:", error);
    if (error instanceof SyntaxError) {
      throw new Error("Failed to parse quiz questions. Please try again.");
    }
    throw new Error(error.message || "Failed to generate quiz questions");
  }
}

export async function saveQuizResult(questions, answers, score) {
  const { userId } = await auth();
  if (!userId) throw new Error("Unauthorized");

  const user = await db.user.findUnique({
    where: { clerkUserId: userId },
  });

  if (!user) throw new Error("User not found");

  const questionResults = questions.map((q, index) => ({
    question: q.question,
    answer: q.correctAnswer,
    userAnswer: answers[index],
    isCorrect: q.correctAnswer === answers[index],
    explanation: q.explanation,
  }));

  // Get wrong answers
  const wrongAnswers = questionResults.filter((q) => !q.isCorrect);

  // Only generate improvement tips if there are wrong answers
  let improvementTip = null;
  if (wrongAnswers.length > 0) {
    const wrongQuestionsText = wrongAnswers
      .map(
        (q) =>
          `Question: "${q.question}"\nCorrect Answer: "${q.answer}"\nUser Answer: "${q.userAnswer}"`
      )
      .join("\n\n");

    const improvementPrompt = `
      The user got the following ${user.industry} technical interview questions wrong:

      ${wrongQuestionsText}

      Based on these mistakes, provide a concise, specific improvement tip.
      Focus on the knowledge gaps revealed by these wrong answers.
      Keep the response under 2 sentences and make it encouraging.
      Don't explicitly mention the mistakes, instead focus on what to learn/practice.
    `;

    try {
      const tipResult = await model.generateContent(improvementPrompt);

      improvementTip = tipResult.response.text().trim();
      console.log(improvementTip);
    } catch (error) {
      console.error("Error generating improvement tip:", error);
      // Continue without improvement tip if generation fails
    }
  }

  try {
    const assessment = await db.assessment.create({
      data: {
        userId: user.id,
        quizScore: score,
        questions: questionResults,
        category: "Technical",
        improvementTip,
      },
    });

    return assessment;
  } catch (error) {
    console.error("Error saving quiz result:", error);
    throw new Error("Failed to save quiz result");
  }
}

export async function getAssessments() {
  const { userId } = await auth();
  if (!userId) throw new Error("Unauthorized");

  const user = await db.user.findUnique({
    where: { clerkUserId: userId },
  });

  if (!user) throw new Error("User not found");

  try {
    const assessments = await db.assessment.findMany({
      where: {
        userId: user.id,
      },
      orderBy: {
        createdAt: "asc",
      },
    });

    return assessments;
  } catch (error) {
    console.error("Error fetching assessments:", error);
    throw new Error("Failed to fetch assessments");
  }
}

export async function createMockInterview(formData) {
  const { userId } = await auth();
  if (!userId) throw new Error("Unauthorized");

  const user = await db.user.findUnique({
    where: { clerkUserId: userId },
  });

  if (!user) throw new Error("User not found");

  const { jobDescription, jobTitle, companyName, questionCount, questionTypes } =
    formData;

  const prompt = `
    Based on the following job description, generate ${questionCount} interview questions.
    The questions should be a mix of the following types: ${questionTypes.join(
      ", "
    )}.

    Job Title: ${jobTitle}
    Company: ${companyName || "Not specified"}
    Job Description:
    ---
    ${jobDescription}
    ---

    Return the response in this JSON format only, with no additional text or markdown:
    {
      "questions": [
        {
          "question": "string",
          "type": "technical | behavioral | situational"
        }
      ]
    }
  `;

  try {
    const result = await model.generateContent(prompt);
    const response = result.response;
    const text = response.text().replace(/```json\n?/g, "").replace(/```\n?/g, "").trim();
    const generated = JSON.parse(text);

    const interview = await db.mockInterview.create({
      data: {
        userId: user.id,
        jobDescription,
        jobTitle,
        companyName,
        questionCount: parseInt(questionCount, 10),
        questionTypes,
        questions: generated.questions || [],
      },
    });

    revalidatePath("/interview");
    return interview;
  } catch (error) {
    console.error("Error creating mock interview:", error);
    throw new Error("Failed to create mock interview. The AI model may have returned an invalid format.");
  }
}

export async function getMockInterviews() {
  const { userId } = await auth();
  if (!userId) throw new Error("Unauthorized");

  const user = await db.user.findUnique({
    where: { clerkUserId: userId },
  });

  if (!user) throw new Error("User not found");

  return await db.mockInterview.findMany({
    where: { userId: user.id },
    orderBy: { createdAt: "desc" },
  });
}

export async function getMockInterviewById(interviewId) {
  const { userId } = await auth();
  if (!userId) throw new Error("Unauthorized");

  const user = await db.user.findUnique({
    where: { clerkUserId: userId },
  });

  if (!user) throw new Error("User not found");

  const interview = await db.mockInterview.findUnique({
    where: {
      id: interviewId,
      userId: user.id,
    },
  });

  if (!interview) {
    throw new Error("Interview not found");
  }

  return interview;
}

export async function submitAnswerAndGetFeedback({ interviewId, questionIndex, answer }) {
  const { userId } = await auth();
  if (!userId) throw new Error("Unauthorized");

  const interview = await getMockInterviewById(interviewId);
  const currentQuestion = interview.questions[questionIndex];

  const feedbackPrompt = `
    Analyze the user's answer for an interview question based on the provided job description.

    **Job Description:**
    ---
    ${interview.jobDescription}
    ---

    **Interview Question:**
    "${currentQuestion.question}"

    **User's Answer:**
    "${answer}"

    **Instructions:**
    Provide feedback on the user's answer. Your analysis should be critical yet constructive.
    Return the response in this JSON format only, with no additional text or markdown:
    {
      "strengths": ["A key strength of the answer.", "Another positive aspect."],
      "areasForImprovement": ["A specific area to improve.", "Another suggestion for enhancement."],
      "sampleAnswer": "A well-structured, concise, and excellent sample answer that demonstrates the STAR method (Situation, Task, Action, Result) if applicable.",
      "score": number
    }

    - **strengths**: List 1-2 concise strengths of the answer.
    - **areasForImprovement**: List 1-2 specific, actionable areas for improvement.
    - **sampleAnswer**: Provide a strong sample answer.
    - **score**: Rate the answer on a scale of 1 to 10, where 10 is an exceptional, job-winning answer.
  `;

  let feedback = {};
  try {
    const result = await model.generateContent(feedbackPrompt);
    const response = result.response;
    const text = response.text().replace(/```json\n?/g, "").replace(/```\n?/g, "").trim();
    feedback = JSON.parse(text);

    // Basic validation of the feedback structure
    if (!feedback.strengths || !feedback.areasForImprovement || !feedback.sampleAnswer || typeof feedback.score !== 'number') {
      throw new Error("AI feedback is in an invalid format.");
    }
  } catch (error) {
    console.error("Error generating feedback:", error);
    throw new Error("Failed to generate AI feedback. Please try submitting again.");
  }

  // Ensure responses array exists and has entries up to the current question
  const responses = [...(interview.responses || [])];
  while (responses.length <= questionIndex) {
    responses.push({});
  }

  responses[questionIndex] = {
    userAnswer: answer,
    feedback: feedback,
  };

  const updatedInterview = await db.mockInterview.update({
    where: { id: interviewId },
    data: {
      responses,
    },
  });

  return updatedInterview;
}
