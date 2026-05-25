// Imports food items from a CSV spreadsheet into MongoDB.
//
// Usage. npx tsx scripts/bulk-import.ts bulk-foods.csv
//
// The CSV must follow the structure defined in the DEVLOG.
// All imported items are marked is_verified: false for manual review.


import "dotenv/config";
import mongoose from "mongoose";
import fs from "fs";
import path from "path";
import { env } from "../config/env.js";
import { FoodItem } from "../models/food.model.js";

// ---------------------------------------------------------------------------
// Minimal CSV parser.
// Handles quoted fields that contain commas.
// ---------------------------------------------------------------------------
const parseCSVLine = (line: string): string[] => {
  const result: string[] = [];
  let current = "";
  let inQuotes = false;

  for (let i = 0; i < line.length; i++) {
    const char = line[i];

    if (char === '"') {
      inQuotes = !inQuotes;
    } else if (char === "," && !inQuotes) {
      result.push(current.trim());
      current = "";
    } else {
      current += char;
    }
  }

  result.push(current.trim());
  return result;
};

const parseCSV = (content: string): Record<string, string>[] => {
  const lines = content
    .split("\n")
    .filter((line) => line.trim().length > 0);

  const headers = parseCSVLine(lines[0]);
  const rows: Record<string, string>[] = [];

  for (let i = 1; i < lines.length; i++) {
    const values = parseCSVLine(lines[i]);
    const row: Record<string, string> = {};

    headers.forEach((header, index) => {
      row[header.trim()] = values[index] ?? "";
    });

    rows.push(row);
  }

  return rows;
};

// ---------------------------------------------------------------------------
// Map a CSV row to a food_items document
// ---------------------------------------------------------------------------
const mapRowToFoodItem = (row: Record<string, string>) => {
  const splitField = (val: string): string[] =>
    val
      .split(",")
      .map((s) => s.trim())
      .filter((s) => s.length > 0);

  return {
    name: row.name?.trim(),
    regional_names: splitField(row.regional_names ?? ""),
    description: row.description?.trim(),
    tags: splitField(row.tags ?? ""),
    meal_types: splitField(row.meal_types ?? ""),
    allergen_tags: splitField(row.allergen_tags ?? ""),
    region: row.region?.trim(),
    image_path: row.image_path?.trim(),
    calories_per_100g: parseFloat(row.calories_per_100g) || 0,
    protein_g: parseFloat(row.protein_g) || 0,
    carbs_g: parseFloat(row.carbs_g) || 0,
    fat_g: parseFloat(row.fat_g) || 0,
    is_verified: false,  // always false on bulk import. review manually in Atlas.
    usda_ref: null,
  };
};

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------
const runBulkImport = async (): Promise<void> => {
  const csvPath = process.argv[2];

  if (!csvPath) {
    console.error("Usage. npx tsx scripts/bulk-import.ts path/to/file.csv");
    process.exit(1);
  }

  const absolutePath = path.resolve(csvPath);

  if (!fs.existsSync(absolutePath)) {
    console.error(`File not found. ${absolutePath}`);
    process.exit(1);
  }

  const content = fs.readFileSync(absolutePath, "utf-8");
  const rows = parseCSV(content);

  console.log(`Parsed ${rows.length} rows from CSV.`);

  await mongoose.connect(env.MONGO_URI);

  console.log("MongoDB connected. Starting bulk import.");

  let inserted = 0;
  let skipped = 0;
  let invalid = 0;

  for (const row of rows) {
    if (!row.name || !row.region || !row.description) {
      console.warn(
        `Skipping invalid row. missing name, region, or description. ` +
        `Row. ${JSON.stringify(row)}`
      );
      invalid++;
      continue;
    }

    const foodItem = mapRowToFoodItem(row);

    try {
      await FoodItem.create(foodItem);
      inserted++;
      console.log(`Inserted. ${foodItem.name}`);
    } catch (err: any) {
      if (err.code === 11000) {
        skipped++;
        console.log(`Skipped duplicate. ${foodItem.name}`);
      } else {
        invalid++;
        console.error(`Failed. ${foodItem.name}.`, err.message);
      }
    }
  }

  console.log(`\nBulk import complete.`);
  console.log(
    `Inserted. ${inserted}. Skipped duplicates. ${skipped}. Invalid rows. ${invalid}`
  );
  console.log(
    "All imported items are marked is_verified: false. " +
    "Review in MongoDB Atlas and set is_verified: true before they appear in spins."
  );

  await mongoose.disconnect();
};

runBulkImport().catch(console.error);