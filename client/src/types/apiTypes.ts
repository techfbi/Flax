/* ── Standard API envelope ──────────────────────────────────── */
export interface ApiResponse<T = unknown> {
  success: boolean
  message: string
  data: T
}

/* ── Auth ───────────────────────────────────────────────────── */
export interface AuthUser {
  id: string
  email: string
  displayName: string
  avatarUrl: string | null
  isVerified: boolean
  createdAt: string
}

export interface FullProfile {
  id: string
  email: string
  display_name: string
  avatar_url: string | null
  role: string
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

export interface LoginData {
  accessToken: string
  user: AuthUser
}

export interface RegisterData {
  accessToken?: string
  user?: AuthUser
  /** Present when email verification is required */
  requiresVerification?: boolean
  pendingId?: number
  message?: string
}

export interface GoogleAuthData extends LoginData {
  isNewUser: boolean
}

export interface RefreshData {
  accessToken: string
}

/* ── Health profile enums ────────────────────────────────────── */
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

export type AgeRange =
  | '18-24' | '25-34' | '35-44' | '45-54' | '55-64' | '65+'

export type MealType = 'breakfast' | 'lunch' | 'dinner' | 'snack' | 'brunch'

/* ── User profile ────────────────────────────────────────────── */
export interface HealthProfile {
  region: string
  dietaryStyle: DietaryStyle
  healthGoal: HealthGoal
  allergies: string[]
  biologicalSex: BiologicalSex
  activityLevel: ActivityLevel
  heightCm: number
  weightKg: number
  ageRange: AgeRange
  exactAge: number | null
  calorieTarget: number | null
  waterTargetMl: number | null
}

export interface UserProfile extends AuthUser {
  healthProfile: HealthProfile | null
}

/* ── Food & Spin ─────────────────────────────────────────────── */
export interface Food {
  id: string
  name: string
  imageUrl: string
  caloriesPer100g: number
  proteinG: number
  carbsG: number
  fatG: number
  region: string
  tags: string[]
}

export interface SpinResult {
  food: Food
  reasoning: string
  pantryMatchUsed: boolean
}

export interface SpinFilters {
  tags: string[]
  mealTypes: MealType[]
}

export interface SpinHistoryEntry {
  id: string
  food: Food
  mealType: MealType
  spunAt: string
}

export interface FlaggedMeal {
  id: string
  food: Food
  flaggedAt: string
}

/* ── Meal logs ───────────────────────────────────────────────── */
export interface MealLog {
  id: string
  foodRef: string | null
  foodName: string
  customName: string | null
  quantityGrams: number
  mealType: MealType
  calories: number
  proteinG: number
  carbsG: number
  fatG: number
  loggedDate: string
  createdAt: string
}

export interface MealTypeBreakdown {
  breakfast: number
  lunch: number
  dinner: number
  snack: number
  brunch: number
}

export interface WeeklyTrendEntry {
  date: string
  calorieTotal: number
}

export interface DashboardData {
  date: string
  calorieTotal: number
  calorieTarget: number
  proteinTotal: number
  carbsTotal: number
  fatTotal: number
  mealTypeBreakdown: MealTypeBreakdown
  weeklyTrend: WeeklyTrendEntry[] // always 7 items
}

/* ── Water ───────────────────────────────────────────────────── */
export interface WaterLog {
  id: string
  amountMl: number
  loggedDate: string
  createdAt: string
}

export interface WaterData {
  entries: WaterLog[]
  dailyTotal: number
  targetMl: number
}

/* ── Streaks ─────────────────────────────────────────────────── */
export interface StreakData {
  goalStreak: number
  goalStreakBest: number
  waterStreak: number
  waterStreakBest: number
  lastGoalDate: string | null
}

/* ── Pantry ──────────────────────────────────────────────────── */
export interface PantryItem {
  id: string
  name: string
  createdAt: string
}

/* ── Chat ────────────────────────────────────────────────────── */
export interface ChatMessage {
  id: string
  role: 'user' | 'assistant'
  content: string
  createdAt: string
}

export interface ChatResponse {
  message: ChatMessage
  reply: ChatMessage
}

/* ── Notifications ───────────────────────────────────────────── */
export interface VapidKeyData {
  publicKey: string
}