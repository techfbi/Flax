import { env } from "../config/env.js";

// Converts a stored relative image path to a full CDN URL.
// Example input. "foods/nigeria/jollof-rice.jpg"
// Example output. "https://pub-xxx.r2.dev/foods/nigeria/jollof-rice.jpg"
//
// To migrate image hosting. change MEDIA_BASE_URL in .env only.
// No database changes needed ever.
export const buildImageUrl = (imagePath: string): string => {
  return `${env.MEDIA_BASE_URL}/${imagePath}`;
};

// Takes any object that has image_path and returns it
// with image_url attached. Use this before returning
// any food data to the frontend.
export const withImageUrl = <T extends { image_path: string }>(
  food: T
): T & { image_url: string } => {
  return {
    ...food,
    image_url: buildImageUrl(food.image_path),
  };
};