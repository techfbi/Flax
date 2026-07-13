import { env } from "../config/env.js";

// Converts a stored relative image path to a full CDN URL.
// Example input. "foods/nigeria/jollof-rice.jpg"
// Example output. "https://pub-xxx.r2.dev/foods/nigeria/jollof-rice.jpg"
//
// To migrate image hosting. we change MEDIA_BASE_URL in .env only. No database changes needed ever.
export const buildImageUrl = (imagePath: string): string => {
  // Already a full URL, Cloudinary or otherwise, use it as is.
  // Only prefix MEDIA_BASE_URL onto genuinely relative paths.
  if (imagePath.startsWith("http://") || imagePath.startsWith("https://")) {
    return imagePath;
  }
  return `${env.MEDIA_BASE_URL}/${imagePath}`;
};

// Takes any object that has image_path and returns it with image_url attached. we use this before returning
// any food data to the frontend.
export const withImageUrl = <T extends { image_path: string }>( // This means this function accepts ANY object type, as long as it has image_path.
  food: T
): T & { image_url: string } => { // Means return the original object type PLUS image_url.
  return {
    ...food,
    image_url: buildImageUrl(food.image_path),
  };
};