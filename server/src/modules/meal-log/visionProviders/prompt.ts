import { stripThinkTags } from "../../../shared/text.helpers.js";
import type { ScannedFoodItem } from "./types.js";

export const buildScanPrompt = (description?: string): string => {
  const base = `
You are a registered dietitian and food composition expert, experienced
with West African and Nigerian dishes and real world plate composition.

Identify every distinct food item visible in this image. A plate often
has several, rice, stew, and meat are three separate items, not one.

For each item return an object with:
- name (string)
- portion_grams (number, your best real world estimate of that item's weight)
- calories (number, total for the estimated portion, not per 100g)
- protein_g (number, total for the estimated portion)
- carbs_g (number, total for the estimated portion)
- fat_g (number, total for the estimated portion)
- confidence (number between 0 and 1, how sure you are of the identification)

Return ONLY a JSON array of these objects, no markdown, no explanation.
`;

  if (!description) return base;

  return `${base}
  The user also described this meal as: "${description}".
Use this description as extra context if your own visual identification of
any item is uncertain. If you are fully confident in what you see for an
item and it conflicts with this description, trust your own visual
analysis over the description for that item.
`;
};

export const parseScanResponse = (raw: string): ScannedFoodItem[] => {
  const withoutThinking = stripThinkTags(raw);
  const cleaned = withoutThinking.replace(/```json|```/g, "").trim();

  if (!cleaned) {
    throw new Error("Response contained only reasoning, no final answer");
  }

  const parsed = JSON.parse(cleaned);
  if (!Array.isArray(parsed)) throw new Error("Response was not an array");

  return parsed.filter(
    (item): item is ScannedFoodItem =>
      typeof item?.name === "string" &&
      typeof item?.portion_grams === "number" &&
      typeof item?.calories === "number" &&
      typeof item?.protein_g === "number" &&
      typeof item?.carbs_g === "number" &&
      typeof item?.fat_g === "number" &&
      typeof item?.confidence === "number",
  );
};