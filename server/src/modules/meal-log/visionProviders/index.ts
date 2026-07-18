import { AppError } from "../../../shared/errors.js";
import { geminiPrimaryVisionProvider, geminiLiteVisionProvider } from "./geminiVision.js";
import { groqQwenVisionProvider, groqLlamaScoutVisionProvider } from "./groqVision.js";
import type { VisionProvider, ScannedFoodItem } from "./types.js";

const VISION_PROVIDERS: VisionProvider[] = [
  geminiPrimaryVisionProvider,
  geminiLiteVisionProvider,
  groqQwenVisionProvider,
  groqLlamaScoutVisionProvider,
];

export const scanMealImage = async (
  imageBase64: string,
  mimeType: string,
  description?: string,
): Promise<{ items: ScannedFoodItem[]; providerUsed: string }> => {
  const errors: string[] = [];

  for (const provider of VISION_PROVIDERS) {
    try {
      const items = await provider.scanMeal(imageBase64, mimeType, description);
      // A provider that answered, even with zero items found, gave a
      // real answer, not a failure. This used to fall through to the
      // next provider on an empty result too, which is wrong, a photo
      // with genuinely no food in it should say so once, not get
      // retried through three more providers hoping one of them
      // invents something that is not there. This was also the whole
      // reason a non food scan took noticeably longer than it should.
      return { items, providerUsed: provider.name };
    } catch (err) {
      errors.push(
        `${provider.name}: ${err instanceof Error ? err.message : "unknown error"}`,
      );
    }
  }

  console.error("[vision] all providers failed", errors);
  throw new AppError(
    "Could not identify food in that photo right now. Try again in a moment, or log this meal manually.",
    502,
    "SCAN_ALL_PROVIDERS_FAILED",
  );
};