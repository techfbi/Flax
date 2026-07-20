import { GoogleGenAI } from "@google/genai";
import { env } from "../../../config/env.js";
import { buildScanPrompt } from "./prompt.js";
import type { VisionProvider, ScanResult } from "./types.js";

const ai = new GoogleGenAI({
  apiKey: env.GEMINI_API_KEY,
  httpOptions: { timeout: 10000 },
});

const SCAN_RESPONSE_SCHEMA = {
  type: "object",
  description:
    "Whether the image shows food at all, judged independently of any user description, plus the identified items if it does.",
  properties: {
    image_shows_food: { type: "boolean" },
    items: {
      type: "array",
      description: "List of distinct identified food items. Empty if image_shows_food is false.",
      items: {
        type: "object",
        properties: {
          name: { type: "string" },
          visual_evidence: { type: "string" },
          portion_grams: { type: "number" },
          calories: { type: "number" },
          protein_g: { type: "number" },
          carbs_g: { type: "number" },
          fat_g: { type: "number" },
          confidence: { type: "number" },
        },
        required: [
          "name",
          "visual_evidence",
          "portion_grams",
          "calories",
          "protein_g",
          "carbs_g",
          "fat_g",
          "confidence",
        ],
      },
    },
  },
  required: ["image_shows_food", "items"],
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
        // Lower than the SDK default. This is a grounding task, not a
        // creative one, less sampling variance means less room for the
        // model to drift toward the text description instead of the image.
        temperature: 0.2,
      },
    });

    if (!result.text) {
      throw new Error(`${name} returned an empty or invalid generation text block.`);
    }

    const parsed = JSON.parse(result.text) as ScanResult;

    // Defense in depth, same rule enforced in parseScanResponse for the
    // Groq path. A false judgement always wins over a populated items array.
    return {
      image_shows_food: parsed.image_shows_food,
      items: parsed.image_shows_food ? parsed.items : [],
    };
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