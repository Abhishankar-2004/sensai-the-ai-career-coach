// Simple test script to verify Gemini API is working
import { generateContentWithRetry } from "./lib/gemini-utils.js";

async function testGemini() {
  try {
    console.log("Testing Gemini API...");
    const result = await generateContentWithRetry("Say hello in a professional manner.");
    const response = result.response;
    console.log("Success! Response:", response.text());
  } catch (error) {
    console.error("Test failed:", error.message);
  }
}

testGemini();