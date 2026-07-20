import { stripThinkTags } from "../../../shared/text.helpers.js";
import type { ScanResult } from "./types.js";

export const buildScanPrompt = (description?: string): string => {
  const visualAnalysis = `
You are a registered dietitian and food composition expert, experienced
with West African and Nigerian dishes and real world plate composition.

Step one, look only at the image. Do not read any description below yet.
Decide: does this image actually show a plate, bowl, or serving of food?
Photos of screens, objects, documents, people, rooms, or anything that is
not food should be judged as not showing food, even if a description
below suggests otherwise. The description is written by the user and may
not match the photo at all, sometimes on purpose, so it must never be the
reason you decide an image contains food.

Step two, only if the image genuinely shows food, identify every distinct
item visible. A plate often has several, rice, stew, and meat are three
separate items, not one. For every item, you must be able to point to the
specific visual evidence for it, its color, shape, texture, or position
in the frame. If you cannot describe what you are seeing that makes you
believe an item is present, do not include it.

For each item return an object with:
- name (string)
- visual_evidence (string, a short phrase describing exactly what you see that identifies this item)
- portion_grams (number, your best real world estimate of that item's weight)
- calories (number, total for the estimated portion, not per 100g)
- protein_g (number, total for the estimated portion)
- carbs_g (number, total for the estimated portion)
- fat_g (number, total for the estimated portion)
- confidence (number between 0 and 1, how sure you are of the identification)

Return ONLY a JSON object of this shape, no markdown, no explanation:
{
  "image_shows_food": boolean,
  "items": [ ... the objects described above, empty array if image_shows_food is false ... ]
}

If image_shows_food is false, items must be an empty array, regardless of
anything written in a description below. Do not invent food that is not
visible just because a description names something. This has happened
before, a user photographed something with no food in it, added a
description naming a real dish out of curiosity, and a food identification
matching the description was returned anyway. That is a serious failure,
it is not acceptable, and this instruction exists specifically to prevent
it happening again.
`;

  if (!description) return visualAnalysis;

  return `${visualAnalysis}
Only after you have completed your own visual judgement above, you may
use the following as secondary context, and only for items you already
believe you can see. The user described this meal as: "${description}".
Use it to help name a dish you can already visually confirm, for example
telling you the general style of a stew you can see but are unsure how to
label. Never use it to add an item you cannot independently see evidence
for, and never let it change your image_shows_food judgement.
`;
};

export const parseScanResponse = (raw: string): ScanResult => {
  const withoutThinking = stripThinkTags(raw);
  const cleaned = withoutThinking.replace(/```json|```/g, "").trim();

  if (!cleaned) {
    throw new Error("Response contained only reasoning, no final answer");
  }

  const parsed = JSON.parse(cleaned);

  if (typeof parsed?.image_shows_food !== "boolean" || !Array.isArray(parsed?.items)) {
    throw new Error("Response was not in the expected image_shows_food and items shape");
  }

  const items = parsed.items.filter(
    (item: unknown): item is ScanResult["items"][number] =>
      typeof (item as any)?.name === "string" &&
      typeof (item as any)?.visual_evidence === "string" &&
      typeof (item as any)?.portion_grams === "number" &&
      typeof (item as any)?.calories === "number" &&
      typeof (item as any)?.protein_g === "number" &&
      typeof (item as any)?.carbs_g === "number" &&
      typeof (item as any)?.fat_g === "number" &&
      typeof (item as any)?.confidence === "number",
  );

  // Defense in depth. Even if the model says image_shows_food is true
  // but somehow also says false, or the reverse, false always wins so an
  // items array never survives alongside a false judgement.
  return {
    image_shows_food: parsed.image_shows_food,
    items: parsed.image_shows_food ? items : [],
  };
};