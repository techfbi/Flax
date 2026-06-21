// Shared response types that mirror the backend's standard envelope.
// { success, message, data }

export interface ApiResponse<T = undefined> {
  success: boolean;
  message?: string;
  data?: T;
}

export interface ApiError {
  success: false;
  message: string;
  code: string;
}

// User and health profile types mirroring GET /api/users/profile response
export interface HealthProfile {
  region:           string | null;
  dietary_style:    string | null;
  health_goal:      HealthGoal | null;
  allergies:        string[];
  health_conditions: string[];
  calorie_target:   number | null;
  biological_sex:   "male" | "female" | null;
  activity_level:   ActivityLevel | null;
  height_cm:        number | null;
  weight_kg:        number | null;
  age_range:        AgeRange | null;
  exact_age:        number | null;
  water_target_ml:  number | null;
}

export interface User {
  id:            string;
  email:         string;
  display_name:  string;
  avatar_url:    string | null;
  role:          string;
  provider:      "local" | "google";
  is_verified:   boolean;
  created_at:    string;
  last_login_at: string | null;
  health:        HealthProfile | null;
}

// Enums matching backend allowed values exactly
export type HealthGoal =
  | "weight_loss"
  | "muscle_gain"
  | "weight_gain"
  | "maintenance"
  | "general_health";

export type ActivityLevel =
  | "sedentary"
  | "lightly_active"
  | "moderately_active"
  | "very_active"
  | "extremely_active";

export type AgeRange =
  | "18-24"
  | "25-34"
  | "35-44"
  | "45-54"
  | "55-64"
  | "65+";

export type MealType =
  | "breakfast"
  | "brunch"
  | "lunch"
  | "dinner"
  | "snack";

// Food item from catalogue search or spin result
export interface FoodItem {
  _id:              string;
  name:             string;
  regional_names:   string[];
  description:      string;
  image_url:        string;
  image_path:       string;
  meal_types:       MealType[];
  tags:             string[];
  allergen_tags:    string[];
  ingredients:      string[];
  calories_per_100g: number;
  protein_g:        number;
  carbs_g:          number;
  fat_g:            number;
}

// Meal log entry
export interface MealLog {
  id:            string;
  food_ref:      string | null;
  food_name:     string | null;
  custom_name:   string | null;
  quantity_grams: number;
  meal_type:     MealType;
  logged_date:   string;
  calories:      number;
  protein_g:     number;
  carbs_g:       number;
  fat_g:         number;
  source:        "catalogue" | "custom" | "spin";
  created_at:    string;
}

// Dashboard response
export interface DashboardData {
  date: string;
  daily_totals: {
    calories:  number;
    protein_g: number;
    carbs_g:   number;
    fat_g:     number;
  };
  by_meal_type: Partial<Record<MealType, {
    calories:  number;
    protein_g: number;
    carbs_g:   number;
    fat_g:     number;
  }>>;
  calorie_target: number | null;
  weekly_trend:   Array<{ date: string; calories: number }>;
  log_count:      number;
}

// Streaks
export interface Streaks {
  goal_streak:        number;
  goal_streak_best:   number;
  last_goal_date:     string | null;
  water_streak:       number;
  water_streak_best:  number;
  last_water_log_date: string | null;
}

// Water log
export interface WaterLog {
  id:          string;
  amount_ml:   number;
  logged_date: string;
  logged_at:   string;
}

export interface WaterLogsResponse {
  date:        string;
  logs:        WaterLog[];
  daily_total: number;
  target_ml:   number | null;
}

// Spin
export interface SpinResult {
  food:         FoodItem;
  reasoning:    string;
  pantry_match: boolean;
}

export interface SpinHistoryEntry {
  id:               string;
  food_ref:         string | null;
  result_name:      string;
  filters_applied:  { meal_type: string | null; tags: string[] };
  was_accepted:     boolean;
  rejection_reason: string | null;
  spun_at:          string;
}

// Chat
export interface ChatMessage {
  role:      "user" | "assistant";
  content:   string;
  createdAt: string;
}

// Pantry
export interface PantryItem {
  id:         number;
  name:       string;
  created_at: string;
}

// Flagged meal
export interface FlaggedMeal {
  id:         number;
  food_ref:   string;
  food_name:  string;
  created_at: string;
}