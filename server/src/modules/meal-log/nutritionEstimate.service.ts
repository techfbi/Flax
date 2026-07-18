import { generateText } from "../../config/ai.js";
import { AppError } from "../../shared/errors.js";

export interface NutritionEstimate {
  calories: number;
  protein_g: number;
  carbs_g: number;
  fat_g: number;
  estimated_grams?: number;
}

const DIETITIAN_FRAMING = `
You are a registered dietitian and food composition expert, fluent in
standard nutrition references such as USDA FoodData Central and West
African food composition data, and experienced with real world home
cooking, portioning, and serving practices, especially for Nigerian
and West African dishes.
`;

const buildPromptForGrams = (
  name: string,
  grams: number,
  description?: string,
): string => `
${DIETITIAN_FRAMING}
Estimate the nutrition for exactly ${grams}g of "${name}".
${description ? `The user also described this meal as: "${description}". Use this for extra context, especially if the name alone is ambiguous.` : ""}

How to approach this:
1. If this is a well known, well documented food or dish, base your
   estimate on its real, established nutritional composition, not a
   rough or generic guess.
2. If it is a less common, homemade, or regional dish without a
   direct reference, identify its likely core ingredients and typical
   preparation method, then reason from the known nutrition of those
   individual ingredients at realistic proportions to build an
   accurate composite estimate, the way a dietitian would when
   something is not in a standard database.
3. Think about what ${grams}g genuinely represents for this specific
   food in real life, its density and how it is typically served,
   rather than treating the number as an abstract weight with no
   relationship to the actual dish.
4. Favor accuracy over convenience, do not round to a tidy looking
   number if the real estimate is not tidy.

Return ONLY a JSON object, no markdown, no explanation, shaped exactly
like this example:
{"calories": 320, "protein_g": 12.5, "carbs_g": 45.2, "fat_g": 8.1}
All four values are totals for the exact ${grams}g portion, not per 100g.
`;

const buildPromptForDescription = (name: string, quantityDescription: string, description?: string): string => `
${DIETITIAN_FRAMING}
A person has described their portion of "${name}" as "${quantityDescription}",
not as a weight. You do not know the exact grams yet, that is part of
what you need to determine. ${description ? `The user also described this meal as: "${description}". Use this for extra context, especially if the name alone is ambiguous.` : ""}

How to approach this:
1. Think about what "${quantityDescription}" of "${name}" actually looks like
   and weighs in real life. The same descriptive unit means different
   things for different foods, a scoop of a dense swallow like eba
   or amala weighs far more than a scoop of a leafy or liquid dish,
   reason about this specific food's real density and how it is
   typically served, not a generic conversion.
2. If this is a well known, well documented food, base the nutrition
   on its real, established composition. If it is less common or
   homemade, identify its likely core ingredients and preparation
   method, then reason from those ingredients at realistic
   proportions, the way a dietitian would when something is not in a
   standard database.
3. Favor accuracy over convenience, do not round to a tidy looking
   number if the real estimate is not tidy.

Return ONLY a JSON object, no markdown, no explanation, shaped exactly
like this example:
{"estimated_grams": 180, "calories": 320, "protein_g": 12.5, "carbs_g": 45.2, "fat_g": 8.1}
estimated_grams is your best real world estimate of the total weight
"${quantityDescription}" of this specific food represents. The remaining four
values are totals for that estimated portion, not per 100g.
`;

const parseEstimate = (raw: string, requireEstimatedGrams: boolean): NutritionEstimate => {
  const cleaned = raw.replace(/```json|```/g, "").trim();
  const parsed = JSON.parse(cleaned);

  const values = ["calories", "protein_g", "carbs_g", "fat_g"] as const;
  for (const key of values) {
    if (typeof parsed[key] !== "number") {
      throw new Error(`Missing or invalid ${key} in AI response`);
    }
  }
  if (requireEstimatedGrams && typeof parsed.estimated_grams !== "number") {
    throw new Error("Missing or invalid estimated_grams in AI response");
  }
  return {
    calories: parsed.calories,
    protein_g: parsed.protein_g,
    carbs_g: parsed.carbs_g,
    fat_g: parsed.fat_g,
    ...(requireEstimatedGrams ? { estimated_grams: parsed.estimated_grams } : {}),
  };
};

export const estimateNutrition = async (
  name: string,
  quantity: { grams?: number; quantity_description?: string },
  description?: string,
): Promise<NutritionEstimate> => {
  try {
    const usingDescription = quantity.grams === undefined;
    const prompt = usingDescription
      ? buildPromptForDescription(name, quantity.quantity_description!, description)
      : buildPromptForGrams(name, quantity.grams!, description);

    const { text } = await generateText(prompt, 250, 0.3);
    return parseEstimate(text, usingDescription);
  } catch {
    throw new AppError(
      "Could not estimate nutrition for that meal. Try rewording it or enter the values manually.",
      502,
      "ESTIMATE_FAILED"
    );
  }
};