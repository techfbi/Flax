import { GoogleGenAI } from "@google/genai";
import { env } from "../../../config/env.js";
import { buildScanPrompt } from "./prompt.js";
import type { VisionProvider, ScannedFoodItem } from "./types.js";

const ai = new GoogleGenAI({
  apiKey: env.GEMINI_API_KEY,
  httpOptions: { timeout: 10000 },
});

const SCAN_RESPONSE_SCHEMA = {
  type: "array",
  description: "List of distinct identified food items.",
  items: {
    type: "object",
    properties: {
      name: { type: "string" },
      portion_grams: { type: "number" },
      calories: { type: "number" },
      protein_g: { type: "number" },
      carbs_g: { type: "number" },
      fat_g: { type: "number" },
      confidence: { type: "number" },
    },
    required: [
      "name",
      "portion_grams",
      "calories",
      "protein_g",
      "carbs_g",
      "fat_g",
      "confidence",
    ],
  },
};

const makeGeminiVisionProvider = (
  name: string,
  model: string,
): VisionProvider => ({
  name,
  scanMeal: async (imageBase64, mimeType, description) => {
    const result = await ai.models.generateContent({
      model,
      contents: [
        { inlineData: { data: imageBase64, mimeType } },
        buildScanPrompt(description),
      ],
      config: {
        responseMimeType: "application/json",
        responseSchema: SCAN_RESPONSE_SCHEMA,
      },
    });

    if (!result.text) {
      throw new Error(`${name} returned an empty or invalid generation text block.`);
    }

    return JSON.parse(result.text) as ScannedFoodItem[];
  },
});

export const geminiPrimaryVisionProvider = makeGeminiVisionProvider(
  "gemini-primary",
  "gemini-3.5-flash",
);
export const geminiLiteVisionProvider = makeGeminiVisionProvider(
  "gemini-lite",
  "gemini-3.1-flash-lite",
);