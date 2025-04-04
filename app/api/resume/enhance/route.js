import { NextResponse } from "next/server";
import { GoogleGenerativeAI } from "@google/generative-ai";

// Simple rate limiting implementation
const RATE_LIMIT_WINDOW = 60000; // 1 minute
const MAX_REQUESTS = 2; // Maximum requests per window

// In-memory store for rate limiting
const requestTimestamps = [];

// Helper function to check if we're rate limited
function isRateLimited() {
  const now = Date.now();
  // Remove timestamps older than the window
  while (requestTimestamps.length > 0 && requestTimestamps[0] < now - RATE_LIMIT_WINDOW) {
    requestTimestamps.shift();
  }
  
  // Check if we've exceeded the limit
  if (requestTimestamps.length >= MAX_REQUESTS) {
    return true;
  }
  
  // Add current timestamp
  requestTimestamps.push(now);
  return false;
}

// Helper function to delay execution
const delay = (ms) => new Promise(resolve => setTimeout(resolve, ms));

export async function POST(req) {
  try {
    const { content, type } = await req.json();

    if (!content) {
      return new NextResponse("Content is required", { status: 400 });
    }

    // Check if we're rate limited
    if (isRateLimited()) {
      console.log("Rate limit hit, waiting before processing request");
      // Wait for the rate limit window to reset
      await delay(RATE_LIMIT_WINDOW);
      // Try again
      if (isRateLimited()) {
        return new NextResponse(
          "Rate limit exceeded. Please try again in a minute.",
          { status: 429 }
        );
      }
    }

    let prompt = "";
    switch (type) {
      case "summary":
        prompt = `Improve the following professional summary to make it more impactful and ATS-friendly. Keep it concise and focused on key achievements:

${content}

Return only the improved summary text without any additional formatting or explanation.`;
        break;
      case "skills":
        prompt = `Improve the following skills section to make it more comprehensive and ATS-friendly. Organize skills by category if possible:

${content}

Return only the improved skills text without any additional formatting or explanation.`;
        break;
      default:
        return new NextResponse("Invalid improvement type", { status: 400 });
    }

    try {
      // Initialize the Gemini API
      const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
      const model = genAI.getGenerativeModel({ model: "gemini-1.5-pro" });
      
      // Generate content
      const result = await model.generateContent(prompt);
      const response = await result.response;
      const improvedContent = response.text();

      return NextResponse.json({ content: improvedContent });
    } catch (error) {
      console.error("AI generation error:", error);
      
      // Check if it's a rate limit error from the API
      if (error.message.includes("429") || error.message.includes("Too Many Requests")) {
        return new NextResponse(
          "API rate limit exceeded. Please try again in a minute.",
          { status: 429 }
        );
      }
      
      return new NextResponse(
        error.message || "Failed to enhance content",
        { status: 500 }
      );
    }
  } catch (error) {
    console.error("Enhancement error:", error);
    return new NextResponse(
      error.message || "Failed to enhance content",
      { status: 500 }
    );
  }
}

async function enhanceSection(content, type, keywords, requirements) {
  const prompt = `
    As an expert resume writer, enhance the following ${type} to make it more impactful and ATS-friendly.
    Current content: "${content}"

    Industry-specific keywords to include: ${keywords.join(", ")}
    Industry requirements to address: ${requirements.join(", ")}

    Requirements:
    1. Use strong action verbs
    2. Include specific metrics and quantifiable results
    3. Highlight relevant technical skills and tools
    4. Keep it concise but detailed
    5. Focus on achievements over responsibilities
    6. Use industry-specific keywords naturally
    7. Ensure ATS compatibility
    8. Include quantifiable results
    9. Use present tense for current roles, past tense for previous roles
    10. Avoid generic statements and clichés

    Return only the enhanced content without any additional text or explanations.
  `;

  const result = await generateContentWithRetry(prompt);
  const response = result.response;
  return response.text().trim();
}

async function enhanceExperience(experience, keywords, requirements) {
  const enhancedExperience = [];
  
  for (const exp of experience) {
    const prompt = `
      As an expert resume writer, enhance the following work experience description to make it more impactful and ATS-friendly.
      Company: ${exp.company}
      Position: ${exp.position}
      Current description: "${exp.description}"

      Industry-specific keywords to include: ${keywords.join(", ")}
      Industry requirements to address: ${requirements.join(", ")}

      Requirements:
      1. Use strong action verbs
      2. Include specific metrics and quantifiable results
      3. Highlight relevant technical skills and tools
      4. Keep it concise but detailed
      5. Focus on achievements over responsibilities
      6. Use industry-specific keywords naturally
      7. Ensure ATS compatibility
      8. Include quantifiable results
      9. Use present tense for current roles, past tense for previous roles
      10. Avoid generic statements and clichés

      Return only the enhanced description without any additional text or explanations.
    `;

    const result = await generateContentWithRetry(prompt);
    const response = result.response;
    
    enhancedExperience.push({
      ...exp,
      description: response.text().trim(),
    });
  }

  return enhancedExperience;
}

async function enhanceEducation(education, keywords, requirements) {
  const enhancedEducation = [];
  
  for (const edu of education) {
    const prompt = `
      As an expert resume writer, enhance the following education description to make it more impactful and ATS-friendly.
      Institution: ${edu.institution}
      Degree: ${edu.degree}
      Current description: "${edu.description}"

      Industry-specific keywords to include: ${keywords.join(", ")}
      Industry requirements to address: ${requirements.join(", ")}

      Requirements:
      1. Highlight relevant coursework and academic achievements
      2. Include specific projects or research if applicable
      3. Mention relevant skills developed
      4. Keep it concise but detailed
      5. Use industry-specific keywords naturally
      6. Ensure ATS compatibility
      7. Focus on achievements and outcomes
      8. Use past tense
      9. Avoid generic statements
      10. Include GPA if above 3.0

      Return only the enhanced description without any additional text or explanations.
    `;

    const result = await generateContentWithRetry(prompt);
    const response = result.response;
    
    enhancedEducation.push({
      ...edu,
      description: response.text().trim(),
    });
  }

  return enhancedEducation;
}

async function enhanceProjects(projects, keywords, requirements) {
  const enhancedProjects = [];
  
  for (const project of projects) {
    const prompt = `
      As an expert resume writer, enhance the following project description to make it more impactful and ATS-friendly.
      Project: ${project.name}
      Current description: "${project.description}"

      Industry-specific keywords to include: ${keywords.join(", ")}
      Industry requirements to address: ${requirements.join(", ")}

      Requirements:
      1. Use strong action verbs
      2. Include specific metrics and quantifiable results
      3. Highlight relevant technical skills and tools used
      4. Keep it concise but detailed
      5. Focus on achievements and outcomes
      6. Use industry-specific keywords naturally
      7. Ensure ATS compatibility
      8. Include quantifiable results
      9. Use past tense
      10. Avoid generic statements

      Return only the enhanced description without any additional text or explanations.
    `;

    const result = await generateContentWithRetry(prompt);
    const response = result.response;
    
    enhancedProjects.push({
      ...project,
      description: response.text().trim(),
    });
  }

  return enhancedProjects;
} 