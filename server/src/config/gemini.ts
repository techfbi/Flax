import { GoogleGenerativeAI, HarmCategory, HarmBlockThreshold } from "@google/generative-ai";
import { env } from "./env.js";
import axios from "axios";

// Initialise the Gemini client once at module load i.e once the server starts. This is shared across all AI calls in the application.
const genAI = new GoogleGenerativeAI(env.GEMINI_API_KEY);

// ---------------------------------------------------------------------------
// Gemini 2.5 Flash model instance with generation config and safety settings baked in at creation time. This is the correct SDK pattern for the
// @google/generative-ai package. Settings passed at model creation apply to every call made from this instance.
// ---------------------------------------------------------------------------
export const geminiModel = genAI.getGenerativeModel({
  model: "gemini-2.5-flash",
  generationConfig: {
    maxOutputTokens: 500,     // 2 to 3 sentences needs no more than 500 tokens
    temperature: 0.7,         // some creativity but not unpredictable
    topP: 0.9,             // keep responses natural
  },
  safetySettings: [
    {
      category: HarmCategory.HARM_CATEGORY_HARASSMENT,
      threshold: HarmBlockThreshold.BLOCK_ONLY_HIGH,
    },
    {
      category: HarmCategory.HARM_CATEGORY_HATE_SPEECH,
      threshold: HarmBlockThreshold.BLOCK_ONLY_HIGH,
    },
    {
      category: HarmCategory.HARM_CATEGORY_SEXUALLY_EXPLICIT,
      threshold: HarmBlockThreshold.BLOCK_ONLY_HIGH,
    },
    {
      category: HarmCategory.HARM_CATEGORY_DANGEROUS_CONTENT,
      threshold: HarmBlockThreshold.BLOCK_ONLY_HIGH,
    },
  ],
});



// ---------------------------------------------------------------------------
// Chat model instance — higher token limit for multi-turn conversation.
// Separate from geminiModel so chat can have different generation config. Used by the chatbot module.
// ---------------------------------------------------------------------------
export const geminiChatModel = genAI.getGenerativeModel({
  model: "gemini-2.5-flash",
  generationConfig: {
    maxOutputTokens: 800,
    temperature: 0.6,
    topP: 0.9,
  },
  safetySettings: [
    {
      category: HarmCategory.HARM_CATEGORY_HARASSMENT,
      threshold: HarmBlockThreshold.BLOCK_ONLY_HIGH,
    },
    {
      category: HarmCategory.HARM_CATEGORY_HATE_SPEECH,
      threshold: HarmBlockThreshold.BLOCK_ONLY_HIGH,
    },
    {
      category: HarmCategory.HARM_CATEGORY_SEXUALLY_EXPLICIT,
      threshold: HarmBlockThreshold.BLOCK_ONLY_HIGH,
    },
    {
      category: HarmCategory.HARM_CATEGORY_DANGEROUS_CONTENT,
      threshold: HarmBlockThreshold.BLOCK_ONLY_HIGH,
    },
  ],
});