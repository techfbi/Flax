/* Standard API envelope */
export interface ApiResponse<T = unknown> {
  success: boolean
  message: string
  data: T
}

/* Auth */
export interface AuthUser {
  id: string
  email: string
  display_name: string
  role: string
  is_verified: boolean
  created_at: string
}

export interface LoginData {
  accessToken: string
  user: AuthUser
}

export interface RegisterData {
  accessToken?: string
  user?: AuthUser
  requiresVerification?: boolean
  pendingId?: number
  message?: string
}

export interface GoogleAuthData {
  accessToken: string
  user: AuthUser
  isNewUser: boolean
}

export interface RefreshData {
  accessToken: string
}

/*
  FullProfile matches exactly what GET /api/users/profile returns.
  Backend wraps it as: { data: { profile: FullProfile } }
*/
export interface FullProfile {
  id: string
  email: string
  display_name: string
  avatar_url: string | null
  role: string
  provider: string
  is_verified: boolean
  created_at: string
  last_login_at: string | null
  health: {
    region: string | null
    dietary_style: string | null
    health_goal: string | null
    allergies: string[]
    health_conditions: string[]
    calorie_target: number | null
    biological_sex: string | null
    activity_level: string | null
    height_cm: number | null
    weight_kg: number | null
    age_range: string | null
    exact_age: number | null
    water_target_ml: number | null
  } | null
}

/* Enums matching backend schema values exactly */
export type DietaryStyle =
  | 'omnivore' | 'vegetarian' | 'vegan' | 'pescatarian'
  | 'keto' | 'paleo' | 'halal' | 'kosher'

export type HealthGoal =
  | 'weight_loss' | 'muscle_gain' | 'weight_gain'
  | 'maintenance' | 'general_health'

export type BiologicalSex = 'male' | 'female'

export type ActivityLevel =
  | 'sedentary' | 'lightly_active' | 'moderately_active'
  | 'very_active' | 'extremely_active'

export type AgeRange = '18-24' | '25-34' | '35-44' | '45-54' | '55-64' | '65+'

export type MealType = 'breakfast' | 'lunch' | 'dinner' | 'snack' | 'brunch'

/*
  Food matches FoodResult from spin.service.ts exactly.
  Backend returns snake_case. _id is the MongoDB ObjectId as string.
  image_url is fully qualified CDN URL, use directly.
*/
export interface Food {
  _id: string
  name: string
  description: string
  image_url: string
  image_path: string
  tags: string[]
  meal_types: string[]
  allergen_tags: string[]
  ingredients: string[]
  calories_per_100g: number
  protein_g: number
  carbs_g: number
  fat_g: number
}

/*
  SpinResult: backend returns { data: { food, reasoning, pantry_match } }
  pantry_match (not pantryMatchUsed) is the exact key.
*/
export interface SpinResult {
  food: Food
  reasoning: string
  pantry_match: boolean
}

/*
  SpinFilters: backend returns { data: { region, filters } }
  where filters has { meal_types, tags }
*/
export interface SpinFilters {
  meal_types: string[]
  tags: string[]
}

export interface SpinHistoryEntry {
  id: string
  food_ref: string
  result_name: string
  filters_applied: Record<string, unknown>
  was_accepted: boolean
  created_at: string
}

export interface FlaggedMeal {
  id: string
  food_ref: string
  food_name: string
  created_at: string
}

/*
  MealLogEntry matches MealLogEntry from meallog.service.ts exactly.
  Backend returns snake_case. All nutrition values are numbers.
  Backend wraps GET /api/meal-logs as { data: { logs, date } }
*/
export interface MealLogEntry {
  id: string
  food_ref: string | null
  food_name: string | null
  custom_name: string | null
  quantity_grams: number
  meal_type: MealType
  logged_date: string
  calories: number
  protein_g: number
  carbs_g: number
  fat_g: number
  source: string
  created_at: string
}

/*
  DashboardData matches DashboardData from meallog.service.ts exactly.
  Backend wraps as { data: { dashboard } }
*/
export interface DashboardData {
  date: string
  daily_totals: {
    calories: number
    protein_g: number
    carbs_g: number
    fat_g: number
  }
  by_meal_type: Record<string, {
    calories: number
    protein_g: number
    carbs_g: number
    fat_g: number
  }>
  calorie_target: number | null
  weekly_trend: Array<{ date: string; calories: number }>
  log_count: number
}

/*
  Water: GET /api/water returns { data: { date, logs, daily_total, target_ml } }
  Individual log entry has id, amount_ml, logged_date, logged_at (not created_at).
*/
export interface WaterLogEntry {
  id: string
  amount_ml: number
  logged_date: string
  logged_at: string
}

export interface WaterData {
  date: string
  logs: WaterLogEntry[]
  daily_total: number
  target_ml: number | null
}

/*
  Streaks: GET /api/streaks returns { data: { streaks } }
  where streaks has snake_case keys from the DB RETURNING clause.
*/
export interface StreakData {
  goal_streak: number
  goal_streak_best: number
  last_goal_date: string | null
  water_streak: number
  water_streak_best: number
  last_water_log_date: string | null
}

/*
  PantryItem: GET /api/pantry returns { data: { pantry_items: PantryItem[] } }
  POST /api/pantry returns { data: { item: PantryItem } }
*/
export interface PantryItem {
  id: string
  name: string
  created_at: string
}

/*
  Chat: GET /api/chat/history returns { data: { messages } }
  POST /api/chat returns { data: { reply, modelUsed, isFallback } }
  Each message has role, content, createdAt (camelCase from MongoDB).
*/
export interface ChatMessage {
  role: 'user' | 'assistant'
  content: string
  createdAt: string
}

export interface ChatHistoryData {
  messages: ChatMessage[]
}

export interface ChatReplyData {
  reply: string
  modelUsed: string
  isFallback: boolean
}

/*
  Food search: GET /api/foods/search returns { data: { results, count, query, region } }
  Each result is the same Food shape (FoodResult from MongoDB with image_url added).
*/
export interface FoodSearchData {
  results: Food[]
  count: number
  query: string
  region: string
}

/* Notifications */
export interface VapidKeyData {
  publicKey: string
}