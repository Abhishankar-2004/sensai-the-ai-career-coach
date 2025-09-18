"use server";

import { db } from "@/lib/prisma";
import { auth } from "@clerk/nextjs/server";
import { revalidatePath } from "next/cache";
import { generateContentWithRetry, handleGeminiError } from "@/lib/gemini-utils";

export async function generateQuiz(jobDescription, questionTypes) {
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
    You are an expert career coach and interview preparer.
    Your task is to generate 10 high-quality, multiple-choice interview questions based on the provided job description and user profile.

    **User Profile:**
    - Industry: ${user.industry || 'Not specified'}
    - Key Skills: ${user.skills.join(', ') || 'Not specified'}

    **Job Description:**
    ----
    ${jobDescription}
    ----

    **Question Requirements:**
    1.  **Mix of Types:** The questions should cover the following areas: ${questionTypes.join(", ")}. However, each question MUST be categorized as one of these three types only: "technical", "behavioral", or "situational".
    2.  **Type Definitions:**
        - "technical": Questions about technical skills, programming, tools, technologies, problem-solving approaches
        - "behavioral": Questions about past experiences, teamwork, leadership, communication, work style
        - "situational": Questions about hypothetical scenarios, decision-making, handling challenges
    3.  **Relevance:** Each question must be directly relevant to the skills, responsibilities, and qualifications mentioned in the job description.
    4.  **Clarity:** Questions should be clear, concise, and unambiguous.
    5.  **Plausible Options:** All 4 multiple-choice options should be plausible, but only one should be the correct and best answer.
    6.  **Correct Answer Validation:** The \`correctAnswer\` field *must* exactly match one of the strings in the \`options\` array.
    7.  **Insightful Explanations:** The explanation for the correct answer should be insightful, explaining *why* it\'s the best choice and providing context.

    **IMPORTANT:** The "type" field must be exactly one of: "technical", "behavioral", or "situational". Do not use any other category names.

    **Output Format:**
    Return the response in this JSON format only, with no additional text or markdown.
    The JSON object must be an object with a single key "questions" which is an array of question objects.
    Ensure the JSON is perfectly formatted.

    {
      "questions": [
        {
          "question": "string",
          "options": ["string", "string", "string", "string"],
          "correctAnswer": "string",
          "explanation": "string",
          "type": "technical | behavioral | situational"
        }
      ]
    }
  `;

  try {
    const result = await generateContentWithRetry(prompt, "gemini-1.5-pro");
    const response = result.response;
    let text = response.text();
    
    // Clean up the response text
    text = text.replace(/```json/g, '').replace(/```/g, '').trim();
    
    // Parse the JSON response
    const quiz = JSON.parse(text);
    
    // Validate the response structure
    if (!quiz.questions || !Array.isArray(quiz.questions) || quiz.questions.length === 0) {
      throw new Error("Invalid or empty quiz format received from the model.");
    }

    // Validate each question
    const validatedQuestions = quiz.questions.map((q, index) => {
      if (!q.question || !q.options || !q.correctAnswer || !q.explanation || !q.type) {
        throw new Error(`Invalid question format at index ${index}: missing required fields.`);
      }
      if (!Array.isArray(q.options) || q.options.length !== 4) {
        throw new Error(`Question ${index + 1} must have exactly 4 options.`);
      }
      if (!q.options.includes(q.correctAnswer)) {
        throw new Error(`Correct answer for question ${index + 1} ('${q.correctAnswer}') must be one of the provided options.`);
      }
      // Map AI-generated categories to allowed types
      const categoryMapping = {
        'technical': 'technical',
        'behavioral': 'behavioral', 
        'situational': 'situational',
        'domain-specific': 'technical',
        'domain specific': 'technical',
        'cultural fit': 'behavioral',
        'cultural-fit': 'behavioral',
        'problem-solving': 'technical',
        'problem solving': 'technical',
        'leadership': 'behavioral',
        'communication': 'behavioral',
        'analytical': 'technical',
        'strategic': 'situational',
        'management': 'behavioral',
        'industry knowledge': 'technical',
        'industry-knowledge': 'technical',
        'soft skills': 'behavioral',
        'soft-skills': 'behavioral',
        'hard skills': 'technical',
        'hard-skills': 'technical',
        'experience': 'behavioral',
        'knowledge': 'technical',
        'skills': 'technical',
        'scenario': 'situational',
        'hypothetical': 'situational',
        'case study': 'situational',
        'case-study': 'situational'
      };
      
      const normalizedType = q.type.toLowerCase().trim();
      const mappedType = categoryMapping[normalizedType];
      
      if (!mappedType) {
        console.warn(`Unknown question type '${q.type}' for question ${index + 1}, defaulting to 'technical'`);
      }
      
      // Update the question type to the mapped value or default to technical
      q.type = mappedType || 'technical';
      
      return q;
    });

    return validatedQuestions;
  } catch (error) {
    console.error("Error generating quiz:", error.message);
    if (error instanceof SyntaxError) {
      throw new Error("Failed to parse quiz questions from the AI. The format was invalid. Please try again.");
    }
    // Re-throw the original error or a more specific one
    throw new Error(error.message || "An unexpected error occurred while generating the quiz.");
  }
}

export async function saveQuizResult(questions, answers, score, questionTypes) {
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
      Don\'t explicitly mention the mistakes, instead focus on what to learn/practice.
    `;

    try {
      const tipResult = await generateContentWithRetry(improvementPrompt, "gemini-1.5-pro");

      improvementTip = tipResult.response.text().trim();
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
        categories: questionTypes,
        improvementTip,
      },
    });

    return assessment;
  } catch (error) {
    console.error("Error saving quiz result:", error); // Log the full error object
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
    Based on the following job description, generate ${questionCount} high-quality interview questions.
    The questions should focus on the following categories: ${questionTypes.join(", ")}.

    Job Title: ${jobTitle}
    Company: ${companyName || "Not specified"}
    Job Description:
    --- 
    ${jobDescription}
    --- 

    **Instructions:**
    1. Generate questions that are directly relevant to the role and job description
    2. Each question should be categorized based on its actual content and purpose
    3. Ensure questions test the specific skills and competencies mentioned in the job description
    4. Include a brief explanation of why each question is relevant to the role

    Return the response in this JSON format only, with no additional text or markdown:
    {
      "questions": [
        {
          "question": "string",
          "type": "category name based on actual question content",
          "relevance": "brief explanation of why this question is relevant to the role",
          "skillsAssessed": ["skill1", "skill2"]
        }
      ],
      "categoryBreakdown": {
        "category_name": {
          "count": number,
          "percentage": number,
          "description": "what this category assesses for this specific role"
        }
      }
    }
  `;

  try {
    const result = await generateContentWithRetry(prompt, "gemini-1.5-pro");
    const response = result.response;
    const text = response.text().replace(/```json\n?/g, "").replace(/```\n?/g, "").trim();
    const generated = JSON.parse(text);

    // Validate and process the generated content
    const questions = generated.questions || [];
    const categoryBreakdown = generated.categoryBreakdown || {};

    // Calculate actual category distribution from generated questions
    const actualCategories = {};
    questions.forEach(q => {
      const category = q.type.toLowerCase();
      actualCategories[category] = (actualCategories[category] || 0) + 1;
    });

    // Convert counts to percentages
    const totalQuestions = questions.length;
    const finalCategoryBreakdown = {};
    Object.keys(actualCategories).forEach(category => {
      finalCategoryBreakdown[category] = {
        count: actualCategories[category],
        percentage: Math.round((actualCategories[category] / totalQuestions) * 100),
        description: categoryBreakdown[category]?.description || `${category} questions for this role`
      };
    });

    const interview = await db.mockInterview.create({
      data: {
        userId: user.id,
        jobDescription,
        jobTitle,
        companyName,
        questionCount: parseInt(questionCount, 10),
        questionTypes: Object.keys(actualCategories), // Use actual categories from generated questions
        questions: questions,
        categoryBreakdown: finalCategoryBreakdown, // Store the actual breakdown
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

  // Generate AI feedback for the answer
  const feedbackPrompt = `
    You are an expert interview coach. Analyze the following interview response and provide detailed feedback.

    **Job Title:** ${interview.jobTitle}
    **Company:** ${interview.companyName || "Not specified"}
    
    **Job Description:**
    --- 
    ${interview.jobDescription}
    --- 

    **Question:** ${currentQuestion.question}
    **Question Type:** ${currentQuestion.type}
    **User\'s Answer:** ${answer}

    **Instructions:**
    1. Provide a score from 1-10 (10 being excellent)
    2. Identify 2-3 specific strengths in the answer
    3. Identify 2-3 specific areas for improvement
    4. Provide detailed feedback (2-3 sentences) on how to improve the answer
    5. Consider relevance to the job description, clarity, structure, and completeness

    Return the response in this JSON format only, with no additional text or markdown:
    {
      "score": number,
      "strengths": ["string", "string", "string"],
      "improvements": ["string", "string", "string"],
      "detailedFeedback": "string"
    }
  `;

  let feedback = {
    score: 5,
    strengths: ["Response provided"],
    improvements: ["Could be more detailed"],
    detailedFeedback: "Could not generate detailed feedback at this time."
  };

  try {
    const result = await generateContentWithRetry(feedbackPrompt, "gemini-1.5-pro");
    const response = result.response;
    const text = response.text().replace(/```json\n?/g, "").replace(/```\n?/g, "").trim();
    feedback = JSON.parse(text);
  } catch (error) {
    console.error("Error generating feedback:", error);
    // Continue with default feedback if AI generation fails
  }

  // Ensure responses array exists and has entries up to the current question
  const responses = [...(interview.responses || [])];
  while (responses.length <= questionIndex) {
    responses.push({});
  }

  responses[questionIndex] = {
    userAnswer: answer,
    feedback: feedback,
    answeredAt: new Date(),
  };

  const updatedInterview = await db.mockInterview.update({
    where: { id: interviewId },
    data: {
      responses,
      currentQuestion: Math.min(questionIndex + 1, interview.questions.length),
    },
  });

  return updatedInterview;
}

export async function completeMockInterview(interviewId) {
  const { userId } = await auth();
  if (!userId) throw new Error("Unauthorized");

  const interview = await getMockInterviewById(interviewId);

  if (interview.status === 'completed') {
    return interview; // Already completed
  }

  // Calculate overall score
  const answeredResponses = interview.responses.filter(r => r && r.feedback && typeof r.feedback.score === 'number');
  const totalScore = answeredResponses.reduce((sum, r) => sum + r.feedback.score, 0);
  const overallScore = answeredResponses.length > 0 ? parseFloat((totalScore / answeredResponses.length).toFixed(1)) : 0;

  // Generate overall feedback
  const feedbackPrompt = `
    Based on the user\'s performance across multiple questions in a mock interview for the role of "${interview.jobTitle}", provide overall feedback.\n\n    **Job Description:**\n    --- \n    ${interview.jobDescription}\n    --- \n\n    **User\'s Performance Summary:**\n    The user answered ${answeredResponses.length} out of ${interview.questions.length} questions.\n    The average score was ${overallScore} out of 10.\n\n    **Instructions:**\n    Provide a concise, high-level summary of the user\'s performance.\n    - Start with an encouraging opening statement.\n    - Identify 2-3 key overall strengths based on the provided answers.\n    - Identify 2-3 primary areas for improvement across all answers.\n    - Conclude with a positive and motivational closing statement.\n    - Keep the entire feedback to about 4-5 sentences.\n    - Return the feedback as a single string, not JSON.\n  `;

  let overallFeedback = "Could not generate overall feedback at this time.";
  try {
    const result = await generateContentWithRetry(feedbackPrompt, "gemini-1.5-pro");
    overallFeedback = result.response.text().trim();
  } catch (error) {
    console.error("Error generating overall feedback:", error);
  }

  const updatedInterview = await db.mockInterview.update({
    where: { id: interviewId },
    data: {
      status: 'completed',
      overallScore,
      overallFeedback,
      completedAt: new Date(),
    },
  });

  revalidatePath("/interview");
  revalidatePath(`/interview/${interviewId}/summary`);
  return updatedInterview;
}

export async function getImprovedAnswerSuggestion({ interviewId, questionIndex }) {
  const { userId } = await auth();
  if (!userId) throw new Error("Unauthorized");

  const interview = await getMockInterviewById(interviewId);
  const currentQuestion = interview.questions[questionIndex];
  const currentResponse = interview.responses?.[questionIndex];

  if (!currentResponse?.userAnswer) {
    throw new Error("No answer found for this question");
  }

  const improvementPrompt = `
    You are an expert interview coach. Help improve the following interview answer.\n\n    **Job Title:** ${interview.jobTitle}\n    **Company:** ${interview.companyName || "Not specified"}\n    \n    **Job Description:**\n    --- \n    ${interview.jobDescription}\n    --- \n\n    **Question:** ${currentQuestion.question}\n    **Question Type:** ${currentQuestion.type}\n    **Original Answer:** ${currentResponse.userAnswer}\n\n    **Previous Feedback:**\n    - Score: ${currentResponse.feedback?.score || "N/A"}/10\n    - Strengths: ${currentResponse.feedback?.strengths?.join(", ") || "N/A"}\n    - Areas for Improvement: ${currentResponse.feedback?.improvements?.join(", ") || "N/A"}\n\n    **Instructions:**\n    1. Provide an improved version of the answer that addresses the feedback\n    2. Maintain the user\'s authentic voice and experience level\n    3. Make it more relevant to the job description\n    4. Improve structure, clarity, and completeness\n    5. Include specific examples or details where appropriate\n\n    **Also provide:**\n    - 3 specific tips for improving interview answers in general\n    - Key phrases or keywords that would strengthen responses for this role\n
    Return the response in this JSON format only:\n    {\n      "improvedAnswer": "string",\n      "improvementTips": ["tip1", "tip2", "tip3"],
      "keyPhrases": ["phrase1", "phrase2", "phrase3"],
      "explanation": "Brief explanation of what was improved and why"
    }
  `;

  try {
    const result = await generateContentWithRetry(improvementPrompt, "gemini-1.5-pro");
    const response = result.response;
    const text = response.text().replace(/```json\n?/g, "").replace(/```\n?/g, "").trim();
    return JSON.parse(text);
  } catch (error) {
    console.error("Error generating improved answer:", error);
    const errorInfo = handleGeminiError(error);
    throw new Error(errorInfo.message);
  }
}
