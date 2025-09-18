import { GoogleGenerativeAI } from "@google/generative-ai";

// Helper function to delay execution
const delay = (ms) => new Promise(resolve => setTimeout(resolve, ms));

// Retry function with exponential backoff
export async function retryWithBackoff(fn, maxRetries = 3, baseDelay = 1000) {
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      return await fn();
    } catch (error) {
      console.log(`Attempt ${attempt} failed:`, error.message);
      
      // Don't retry on certain errors
      if (error.status === 400 || error.status === 401 || error.status === 403) {
        throw error;
      }
      
      if (attempt === maxRetries) {
        throw error;
      }
      
      // Exponential backoff: 1s, 2s, 4s
      const delayTime = baseDelay * Math.pow(2, attempt - 1);
      console.log(`Waiting ${delayTime}ms before retry...`);
      await delay(delayTime);
    }
  }
}

// Initialize Gemini with proper configuration
export function initializeGemini(modelName = "gemini-1.5-flash") {
  const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
  return genAI.getGenerativeModel({ 
    model: modelName,
    generationConfig: {
      temperature: 0.7,
      topK: 40,
      topP: 0.95,
      maxOutputTokens: 2048,
    },
  });
}

// Generate content with retry logic
export async function generateContentWithRetry(prompt, modelName = "gemini-1.5-flash") {
  if (!process.env.GEMINI_API_KEY) {
    throw new Error("GEMINI_API_KEY is not configured");
  }
  
  const model = initializeGemini(modelName);
  
  return await retryWithBackoff(async () => {
    return await model.generateContent(prompt);
  });
}

// Handle common Gemini API errors
export function handleGeminiError(error) {
  console.error("Gemini API error:", error);
  
  // Handle network errors
  if (error.message.includes("fetch")) {
    return {
      message: "Network error. Please check your internet connection and try again.",
      status: 503
    };
  }
  
  // Handle service unavailable
  if (error.status === 503 || error.message.includes("Service Unavailable") || error.message.includes("503")) {
    return {
      message: "AI service is temporarily unavailable. Please try again in a few moments.",
      status: 503
    };
  }
  
  // Handle rate limiting
  if (error.status === 429 || error.message.includes("429") || error.message.includes("Too Many Requests") || error.message.includes("quota")) {
    return {
      message: "API rate limit exceeded. Please try again in a minute.",
      status: 429
    };
  }
  
  // Handle authentication errors
  if (error.status === 401 || error.status === 403 || error.message.includes("API key")) {
    return {
      message: "Authentication error. Please check your API configuration.",
      status: 401
    };
  }
  
  // Handle bad requests
  if (error.status === 400) {
    return {
      message: "Invalid request. Please check your input and try again.",
      status: 400
    };
  }
  
  // Handle timeout errors
  if (error.message.includes("timeout")) {
    return {
      message: "Request timed out. Please try again.",
      status: 408
    };
  }
  
  return {
    message: "Failed to process request. Please try again later.",
    status: 500
  };
}