"use server";

import { db } from "@/lib/prisma";
import { auth } from "@clerk/nextjs/server";
import { generateContentWithRetry, handleGeminiError } from "@/lib/gemini-utils";
import { revalidatePath } from "next/cache";

export async function saveResume(content) {
  console.log("saveResume action called with content length:", content?.length || 0);
  
  const { userId } = await auth();
  console.log("User ID from auth:", userId);
  
  if (!userId) {
    console.error("No user ID found - user not authenticated");
    throw new Error("Unauthorized");
  }

  const user = await db.user.findUnique({
    where: { clerkUserId: userId },
  });
  
  console.log("User found:", user ? "Yes" : "No");
  if (!user) {
    console.error("User not found in database for clerkUserId:", userId);
    throw new Error("User not found");
  }

  try {
    console.log("Starting ATS analysis for user industry:", user.industry);
    // Generate ATS score and feedback
    let atsAnalysis;
    try {
      atsAnalysis = await analyzeResume(content, user.industry);
      console.log("ATS analysis completed with score:", atsAnalysis.score);
    } catch (atsError) {
      console.warn("ATS analysis failed, using default values:", atsError.message);
      atsAnalysis = {
        score: 0,
        feedback: JSON.stringify({
          strengths: [],
          improvements: ["ATS analysis temporarily unavailable"],
          keywords: [],
          suggestions: []
        })
      };
    }
    
    console.log("Saving resume to database for user ID:", user.id);
    const resume = await db.resume.upsert({
      where: {
        userId: user.id,
      },
      update: {
        content,
        atsScore: atsAnalysis.score,
        feedback: atsAnalysis.feedback,
      },
      create: {
        userId: user.id,
        content,
        atsScore: atsAnalysis.score,
        feedback: atsAnalysis.feedback,
      },
    });
    
    console.log("Resume saved successfully with ID:", resume.id);

    revalidatePath("/resume");
    return resume;
  } catch (error) {
    console.error("Error saving resume:", error);
    throw new Error("Failed to save resume");
  }
}

async function analyzeResume(content, industry) {
  const prompt = `
    Analyze this resume for a ${industry} professional and provide:
    1. An ATS compatibility score (0-100)
    2. Specific feedback for improvement
    
    Resume content:
    ${content}
    
    Return the response in this JSON format only:
    {
      "score": number,
      "feedback": {
        "strengths": string[],
        "improvements": string[],
        "keywords": string[],
        "suggestions": string[]
      }
    }
  `;

  try {
    const result = await generateContentWithRetry(prompt, "gemini-1.5-pro");
    const response = result.response;
    const analysis = JSON.parse(response.text().trim());
    return {
      score: analysis.score,
      feedback: JSON.stringify(analysis.feedback),
    };
  } catch (error) {
    console.error("Error analyzing resume:", error);
    return {
      score: 0,
      feedback: JSON.stringify({
        strengths: [],
        improvements: ["Failed to analyze resume"],
        keywords: [],
        suggestions: [],
      }),
    };
  }
}

export async function getResume() {
  const { userId } = await auth();
  if (!userId) throw new Error("Unauthorized");

  const user = await db.user.findUnique({
    where: { clerkUserId: userId },
  });

  if (!user) throw new Error("User not found");

  return await db.resume.findUnique({
    where: {
      userId: user.id,
    },
  });
}

export async function improveWithAI({ current, type }) {
  const { userId } = await auth();
  if (!userId) throw new Error("Unauthorized");

  const user = await db.user.findUnique({
    where: { clerkUserId: userId },
    include: {
      industryInsight: true,
    },
  });

  if (!user) throw new Error("User not found");

  // Get industry-specific keywords and requirements
  const industryKeywords = user.industryInsight?.keywords || [];
  const industryRequirements = user.industryInsight?.requirements || [];

  const prompt = `
    As an expert resume writer specializing in ${user.industry}, improve the following ${type} description.
    Current content: "${current}"

    Industry-specific keywords to include: ${industryKeywords.join(", ")}
    Industry requirements to address: ${industryRequirements.join(", ")}

    Requirements:
    1. Use strong action verbs (e.g., "Led", "Developed", "Implemented", "Managed")
    2. Include specific metrics and quantifiable results (e.g., "increased by 25%", "reduced costs by $10,000")
    3. Highlight relevant technical skills and tools
    4. Keep it concise (2-3 sentences) but detailed
    5. Focus on achievements over responsibilities
    6. Use industry-specific keywords naturally
    7. Ensure ATS compatibility
    8. Include quantifiable results
    9. Use present tense for current roles, past tense for previous roles
    10. Avoid generic statements and clichés
    
    Format the response as a single paragraph without any additional text or explanations.
    Make it impactful and professional.
  `;

  try {
    console.log("Sending prompt to Gemini:", prompt);
    const result = await generateContentWithRetry(prompt, "gemini-1.5-pro");
    const response = result.response;
    const improvedContent = response.text().trim();
    
    console.log("Received response from Gemini:", improvedContent);
    
    // Validate the improved content
    if (!improvedContent || improvedContent.length < 10) {
      throw new Error("Failed to generate improved content");
    }
    
    return improvedContent;
  } catch (error) {
    console.error("Error improving content:", error);
    const errorInfo = handleGeminiError(error);
    throw new Error(errorInfo.message);
  }
}

export async function generateResumeTemplate(template) {
  const { userId } = await auth();
  if (!userId) throw new Error("Unauthorized");

  const user = await db.user.findUnique({
    where: { clerkUserId: userId },
    include: {
      industryInsight: true,
    },
  });

  if (!user) throw new Error("User not found");

  const prompt = `
    Generate a professional resume template for a ${user.industry} professional with the following style: ${template}
    
    Include sections for:
    1. Contact Information
    2. Professional Summary
    3. Skills
    4. Work Experience
    5. Education
    6. Projects
    
    Format the response in markdown with proper headings and sections.
    Make it ATS-friendly and professional.
  `;

  try {
    const result = await generateContentWithRetry(prompt, "gemini-1.5-pro");
    const response = result.response;
    return response.text().trim();
  } catch (error) {
    console.error("Error generating template:", error);
    const errorInfo = handleGeminiError(error);
    throw new Error(errorInfo.message);
  }
}

export async function deleteResume() {
  const { userId } = await auth();
  if (!userId) throw new Error("Unauthorized");

  const user = await db.user.findUnique({
    where: { clerkUserId: userId },
  });

  if (!user) throw new Error("User not found");

  try {
    await db.resume.delete({
      where: {
        userId: user.id,
      },
    });

    revalidatePath("/resume");
    return { success: true };
  } catch (error) {
    console.error("Error deleting resume:", error);
    throw new Error("Failed to delete resume");
  }
}
