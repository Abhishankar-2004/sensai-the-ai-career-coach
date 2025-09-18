import { NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { generateContentWithRetry, handleGeminiError } from "@/lib/gemini-utils";

export async function POST(req) {
  try {
    const { userId } = await auth();
    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { jobDescription } = await req.json();
    
    if (!jobDescription || !jobDescription.trim()) {
      return NextResponse.json({ error: "Job description is required" }, { status: 400 });
    }

    const prompt = `
      Analyze the following job description and suggest the most relevant interview question categories.
      
      Based on the role requirements, skills, and responsibilities mentioned, determine which types of interview questions would be most appropriate.
      
      Consider these potential categories:
      - Technical: Programming, system design, technical problem-solving, tools, technologies
      - Behavioral: Past experiences, teamwork, leadership, conflict resolution, communication
      - Situational: Hypothetical scenarios, problem-solving approaches, decision-making
      - Domain-specific: Industry knowledge, specific expertise areas, certifications
      - Cultural fit: Company values, work style, motivation, career goals
      - Problem-solving: Analytical thinking, creative solutions, troubleshooting
      - Leadership: Management experience, mentoring, project leadership
      - Communication: Presentation skills, stakeholder management, documentation
      
      Job Description:
      ---
      ${jobDescription}
      ---
      
      Return a JSON response with:
      1. The top 3-5 most relevant categories for this role
      2. A brief explanation for each category
      3. The estimated percentage distribution of questions across categories
      
      Format:
      {
        "suggestedCategories": [
          {
            "name": "category_name",
            "description": "why this category is relevant for this role",
            "percentage": 30
          }
        ],
        "totalCategories": 4,
        "roleType": "brief description of the role type (e.g., 'Senior Software Engineer', 'Product Manager')"
      }
    `;

    try {
      const result = await generateContentWithRetry(prompt, "gemini-1.5-pro");
      const response = result.response;
      const text = response.text().replace(/```json\n?/g, "").replace(/```\n?/g, "").trim();
      
      const analysis = JSON.parse(text);
      
      // Validate the response structure
      if (!analysis.suggestedCategories || !Array.isArray(analysis.suggestedCategories)) {
        throw new Error("Invalid response format from AI");
      }

      return NextResponse.json(analysis);
    } catch (parseError) {
      console.error("Error parsing AI response:", parseError);
      
      // Fallback to default categories if AI analysis fails
      const fallbackCategories = [
        {
          name: "technical",
          description: "Technical skills and knowledge relevant to the role",
          percentage: 40
        },
        {
          name: "behavioral", 
          description: "Past experiences and soft skills",
          percentage: 35
        },
        {
          name: "situational",
          description: "Problem-solving and decision-making scenarios", 
          percentage: 25
        }
      ];

      return NextResponse.json({
        suggestedCategories: fallbackCategories,
        totalCategories: 3,
        roleType: "General Role"
      });
    }
  } catch (error) {
    console.error("Error analyzing job description categories:", error);
    const errorInfo = handleGeminiError(error);
    return NextResponse.json({ error: errorInfo.message }, { status: errorInfo.status });
  }
}