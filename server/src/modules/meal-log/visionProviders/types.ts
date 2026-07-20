export interface ScannedFoodItem {
  name: string;
  portion_grams: number;
  calories: number;
  protein_g: number;
  carbs_g: number;
  fat_g: number;
  confidence: number;
  // A short phrase describing what in the image indicates this item,
  // e.g. "brown mound with visible steam, left side of plate". Forcing
  // the model to justify each item from pixels it can point to makes it
  // much harder for it to quietly copy the user's text description
  // instead of actually looking at the photo.
  visual_evidence: string;
}

// image_shows_food is judged before the model is allowed to look at the
// user's text description at all. This is what stops a photo of
// something unrelated from coming back labelled as whatever the user
// happened to type in the optional description field.
export interface ScanResult {
  image_shows_food: boolean;
  items: ScannedFoodItem[];
}

export interface VisionProvider {
  name: string;
  scanMeal(
    imageBase64: string,
    mimeType: string,
    description?: string
  ): Promise<ScanResult>;
}