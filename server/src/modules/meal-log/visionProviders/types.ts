export interface ScannedFoodItem {
  name: string;
  portion_grams: number;
  calories: number;
  protein_g: number;
  carbs_g: number;
  fat_g: number;
  confidence: number;
}

export interface VisionProvider {
  name: string;
  scanMeal(
    imageBase64: string,
    mimeType: string,
    description?: string
  ): Promise<ScannedFoodItem[]>;
}