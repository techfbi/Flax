import Groq from "groq-sdk";
import { env } from "./env.js";
import logger from "../config/logger.js";

// ---------------------------------------------------------------------------
// Set up reusable Groq client. Groq runs on custom LPU hardware which is why inference is dramatically faster than GPU-based providers. this directly fixes our slow spin response.
// ---------------------------------------------------------------------------
const groq = new Groq({ apiKey: env.GROQ_API_KEY });

// ---------------------------------------------------------------------------
// Model configuration
// We create fallback chain to handle failure of the primary model gracefully. if the primary fails, we try the fallback before giving up completely.
// ---------------------------------------------------------------------------
const PRIMARY_MODEL = "openai/gpt-oss-120b";
const FALLBACK_MODEL = "llama-3.1-8b-instant";

//-------------------------------------------------------------------------------------
// Reasoning capable models like Qwen and gpt-oss include their raw
// thinking process wrapped in think tags before the real answer,
// Llama never did this so nothing previously needed to handle it.
// If the block is properly closed, strip it and keep what follows.
// If it is opened but never closed, the token budget ran out before
// the model ever reached a real answer, there is nothing usable to
// return, treat it the same as an empty response so the fallback
// chain actually kicks in instead of showing a truncated trace.
//--------------------------------------------------------------------------
const stripThinkTags = (text: string): string => {
  const closed = text.replace(/<think>[\s\S]*?<\/think>/gi, "").trim();
  if (closed) return closed;
  if (/<think>/i.test(text)) return "";
  return text.trim();
};

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

    const text = stripThinkTags(response.choices[0]?.message?.content?.trim() ?? "");

    if (!text) {
      throw new Error("Primary model returned empty response");
    }

    logger.info(`AI response from primary model. {PRIMARY_MODEL}`);

    return { text, modelUsed: PRIMARY_MODEL, isFallback: false };
  } catch (primaryErr: any) {
    // Log the primary failure but do not throw yet. try fallback first.
    logger.warn(
      `Primary AI model failed. ${primaryErr?.message ?? primaryErr}. ` +
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

    const text = stripThinkTags(response.choices[0]?.message?.content?.trim() ?? "");

    if (!text) {
      throw new Error("Fallback model returned empty response");
    }

    logger.warn(
      `AI response from fallback model. {FALLBACK_MODEL}. ` +
      "Primary model was unavailable."
    );

    return { text, modelUsed: FALLBACK_MODEL, isFallback: true };
  } catch (fallbackErr: any) {
    // Both models failed. log and signal the hard fallback.
    logger.error(
      `Both AI models failed. Fallback error. {fallbackErr?.message ?? fallbackErr}`
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

// ---------------------------------------------------------------------------
// generateChatCompletion
// Used exclusively by the chat module. this function takes a structured messages array
// matching the Groq chat completions API format.
// ---------------------------------------------------------------------------
export const generateChatCompletion = async (
  messages: Array<{ role: "system" | "user" | "assistant"; content: string }>
): Promise<{ text: string; modelUsed: string; isFallback: boolean }> => {

  // Attempt 1. primary model
  try {
    const response = await groq.chat.completions.create({
      model: PRIMARY_MODEL,
      messages,
      max_tokens: 800,
      temperature: 0.6,
    });

    const text = stripThinkTags(response.choices[0]?.message?.content?.trim() ?? "");

    if (!text) throw new Error("Primary model returned empty response");

    logger.info(`Chat response from primary model. {PRIMARY_MODEL}`);
    return { text, modelUsed: PRIMARY_MODEL, isFallback: false };

  } catch (primaryErr: any) {
    logger.warn(
      `Primary chat model failed. {primaryErr?.message ?? primaryErr}. ` +
      `Trying fallback. {FALLBACK_MODEL}`
    );
  }

  // Attempt 2. fallback model
  try {
    const response = await groq.chat.completions.create({
      model: FALLBACK_MODEL,
      messages,
      max_tokens: 1200,
      temperature: 0.6,
    });

    const text = stripThinkTags(response.choices[0]?.message?.content?.trim() ?? "");

    if (!text) throw new Error("Fallback model returned empty response");

    logger.warn(
      `Chat response from fallback model. {FALLBACK_MODEL}. ` +
      "Primary model was unavailable."
    );
    return { text, modelUsed: FALLBACK_MODEL, isFallback: true };

  } catch (fallbackErr: any) {
    logger.error(
      `Both chat models failed. {fallbackErr?.message ?? fallbackErr}`
    );
    return { text: "", modelUsed: "none", isFallback: true };
  }
};