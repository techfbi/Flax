import Groq from "groq-sdk";
import { env } from "../../../config/env.js";
import { buildScanPrompt, parseScanResponse } from "./prompt.js";
import type { VisionProvider } from "./types.js";

const groq = new Groq({ apiKey: env.GROQ_API_KEY });

const makeGroqVisionProvider = (name: string, model: string): VisionProvider => ({
  name,
  scanMeal: async (imageBase64, mimeType, description) => {
    const response = await groq.chat.completions.create({
      model,
      messages: [
        {
          role: "user",
          content: [
            { type: "text", text: buildScanPrompt(description) },
            {
              type: "image_url",
              image_url: { url: `data:${mimeType};base64,${imageBase64}` },
            },
          ],
        },
      ],
      max_tokens: 1800,
      temperature: 0.2,
    });
    const text = response.choices[0]?.message?.content ?? "";
    return parseScanResponse(text);
  },
});

export const groqQwenVisionProvider = makeGroqVisionProvider(
  "groq-qwen-vision",
  "qwen/qwen3.6-27b",
);
export const groqLlamaScoutVisionProvider = makeGroqVisionProvider(
  "groq-llama-scout-vision",
  "meta-llama/llama-4-scout-17b-16e-instruct",
);