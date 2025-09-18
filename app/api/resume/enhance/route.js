import { NextResponse } from "next/server";
import { generateContentWithRetry, handleGeminiError } from "@/lib/gemini-utils";

// Simple rate limiting implementation
const RATE_LIMIT_WINDOW = 60000; // 1 minute
const MAX_REQUESTS = 5; // Maximum requests per window (increased from 2)

// In-memory store for rate limiting (per user)
const userRequestTimestamps = new Map();

// Helper function to check if we're rate limited
function isRateLimited(userId = 'anonymous') {
  const now = Date.now();
  
  if (!userRequestTimestamps.has(userId)) {
    userRequestTimestamps.set(userId, []);
  }
  
  const timestamps = userRequestTimestamps.get(userId);
  
  // Remove timestamps older than the window
  while (timestamps.length > 0 && timestamps[0] < now - RATE_LIMIT_WINDOW) {
    timestamps.shift();
  }
  
  // Check if we've exceeded the limit
  if (timestamps.length >= MAX_REQUESTS) {
    return true;
  }
  
  // Add current timestamp
  timestamps.push(now);
  return false;
}

export async function POST(req) {
  try {
    const { content, type } = await req.json();

    if (!content) {
      return new NextResponse("Content is required", { status: 400 });
    }

    // Get user ID for rate limiting (optional, falls back to anonymous)
    let userId = 'anonymous';
    try {
      const { auth } = await import("@clerk/nextjs/server");
      const authResult = await auth();
      if (authResult?.userId) {
        userId = authResult.userId;
      }
    } catch (authError) {
      console.log("Auth not available, using anonymous rate limiting");
    }

    // Check if we're rate limited
    if (isRateLimited(userId)) {
      return new NextResponse(
        "Rate limit exceeded. Please try again in a minute.",
        { status: 429 }
      );
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
      // Generate content with retry logic
      const result = await generateContentWithRetry(prompt);
      const response = await result.response;
      const improvedContent = response.text();

      return NextResponse.json({ content: improvedContent });
    } catch (error) {
      const errorInfo = handleGeminiError(error);
      return new NextResponse(errorInfo.message, { status: errorInfo.status });
    }
  } catch (error) {
    console.error("Enhancement error:", error);
    return new NextResponse(
      error.message || "Failed to enhance content",
      { status: 500 }
    );
  }
}
