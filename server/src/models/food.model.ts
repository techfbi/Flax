import mongoose, { Schema, type Document } from "mongoose";

// ---------------------------------------------------------------------------
// Interface. represents one food item document in MongoDB.
// ---------------------------------------------------------------------------
export interface IFoodItem extends Document {
  name: string;
  regional_names: string[];
  description: string;
  tags: string[];
  meal_types: string[];
  allergen_tags: string[];
  region: string;
  image_path: string;
  ingredients: string[];
  calories_per_100g: number;
  protein_g: number;
  carbs_g: number;
  fat_g: number;
  serving_sizes: { label: string; grams: number }[];
  is_verified: boolean;
  usda_ref: string | null;
  createdAt: Date;
  updatedAt: Date;
}

// ---------------------------------------------------------------------------
// Schema
// ---------------------------------------------------------------------------
const FoodItemSchema = new Schema<IFoodItem>(
  {
    name: {
      type: String,
      required: true,
      unique: true,
      trim: true,
      index: true,
    },
    regional_names: {
      type: [String],
      default: [],
    },
    description: {
      type: String,
      required: true,
      trim: true,
    },
    tags: {
      type: [String],
      required: true,
      index: true,
    },
    meal_types: {
      type: [String],
      required: true,
      index: true,
    },
    allergen_tags: {
      type: [String],
      default: [],
    },
    ingredients: {
      type: [String],
      default: [],
    },
    // Primary field used to filter suggestions per user.
    // A Nigerian user only ever sees Nigerian region foods.
    region: {
      type: String,
      required: true,
      index: true,
    },
    // Relative path only. never a full URL.
    // Full URL constructed at runtime using MEDIA_BASE_URL env variable.
    // Keeps image hosting provider-agnostic.
    image_path: {
      type: String,
      required: true,
    },
    calories_per_100g: {
      type: Number,
      required: true,
      min: 0,
    },
    protein_g: {
      type: Number,
      required: true,
      min: 0,
    },
    carbs_g: {
      type: Number,
      required: true,
      min: 0,
    },
    fat_g: {
      type: Number,
      required: true,
      min: 0,
    },
    serving_sizes: {
      type: [
        {
          label: { type: String, required: true },
          grams: { type: Number, required: true },
          _id: false,
        },
      ],
      default: [],
    },
    is_verified: {
      type: Boolean,
      default: false,
    },
    usda_ref: {
      type: String,
      default: null,
    },
  },
  {
    // Mongoose automatically manages createdAt and updatedAt
    timestamps: true,
  }
);

// REASON FOR TWO SEPARATE INDEXES INSTEAD OF ONE THREE-FIELD INDEX.
// MongoDB cannot create a compound index where two fields are BOTH arrays in the same index definition. This is called the "parallel arrays" restriction. Both tags and meal_types are arrays so combining them
// in one compound index causes MongoDB to throw error code 171.
// Compound index for region plus meal_type queries. Covers. find foods WHERE region = X AND meal_types includes Y
// The 1 means ascending order

FoodItemSchema.index({ region: 1, meal_types: 1 });

// Separate index for tag filtering.
// MongoDB handles array field indexes correctly when they are not combined with another array field in the same compound index.
FoodItemSchema.index({ region: 1, tags: 1 });

export const FoodItem = mongoose.model<IFoodItem>("FoodItem", FoodItemSchema);
