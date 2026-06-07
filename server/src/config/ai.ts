import Groq from "groq-sdk";
import { env } from "./env.js";

// ---------------------------------------------------------------------------
// Set up reusable Groq client. Groq runs on custom LPU hardware which is why inference is dramatically faster than GPU-based providers. this directly fixes our slow spin response.
// ---------------------------------------------------------------------------
const groq = new Groq({ apiKey: env.GROQ_API_KEY });

// ---------------------------------------------------------------------------
// Model configuration
// We create fallback chain to handle failure of the primary model gracefully. if the primary fails, we try the fallback before giving up completely.
// ---------------------------------------------------------------------------
const PRIMARY_MODEL = "llama-3.3-70b-versatile";
const FALLBACK_MODEL = "llama-3.1-8b-instant";

// ---------------------------------------------------------------------------
// generateText
// Core function that all AI calls in the app go through.
// Handles the primary to fallback to hard fallback chain automatically.
// Controllers and services never talk to Groq directly
// ---------------------------------------------------------------------------
export const generateText = async (
  prompt: string,
  maxTokens = 300,
  temperature = 0.7
): Promise<{ text: string; modelUsed: string; isFallback: boolean }> => {

  // ---------------------------------------------------------------------------
  // Attempt 1. primary model
  // ---------------------------------------------------------------------------
  try {
    const response = await groq.chat.completions.create({
      model: PRIMARY_MODEL,
      messages: [{ role: "user", content: prompt }],
      max_tokens: maxTokens,
      temperature,
    });

    const text = response.choices[0]?.message?.content?.trim() ?? "";

    if (!text) {
      throw new Error("Primary model returned empty response");
    }

    console.log(`[REMOVE LOG LATER] AI response from primary model. ${PRIMARY_MODEL}`);

    return { text, modelUsed: PRIMARY_MODEL, isFallback: false };
  } catch (primaryErr: any) {
    // Log the primary failure but do not throw yet. try fallback first.
    console.warn(
      `[REMOVE LOG LATER] Primary AI model failed. ${primaryErr?.message ?? primaryErr}. ` +
      `Trying fallback model. ${FALLBACK_MODEL}`
    );
  }

  // ---------------------------------------------------------------------------
  // Attempt 2. fallback model
  // ---------------------------------------------------------------------------
  try {
    const response = await groq.chat.completions.create({
      model: FALLBACK_MODEL,
      messages: [{ role: "user", content: prompt }],
      max_tokens: maxTokens,
      temperature,
    });

    const text = response.choices[0]?.message?.content?.trim() ?? "";

    if (!text) {
      throw new Error("Fallback model returned empty response");
    }

    console.warn(
      `[REMOVE LOG LATER] AI response from fallback model. ${FALLBACK_MODEL}. ` +
      "Primary model was unavailable."
    );

    return { text, modelUsed: FALLBACK_MODEL, isFallback: true };
  } catch (fallbackErr: any) {
    // Both models failed. log and signal the hard fallback.
    console.error(
      `[REMOVE LOG LATER] Both AI models failed. Fallback error. ${fallbackErr?.message ?? fallbackErr}`
    );

    // Return empty string. caller handles hard fallback.
    return { text: "", modelUsed: "none", isFallback: true };
  }
};

// ---------------------------------------------------------------------------
// generateChatResponse
// Used by the chatbot module. wraps generateText with chat-specific defaults.
// Higher token limit. slightly lower temperature for more consistent answers.
// ---------------------------------------------------------------------------
export const generateChatResponse = async (
  prompt: string
): Promise<{ text: string; modelUsed: string; isFallback: boolean }> => {
  return generateText(prompt, 800, 0.6);
};