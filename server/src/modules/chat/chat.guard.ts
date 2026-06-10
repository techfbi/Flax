// ---------------------------------------------------------------------------
// Domain guard for the nutrition chatbot.
// Runs before any Groq API call to filter out clearly off-topic messages.
// Saves tokens and prevents the LLM from being used for unrelated tasks.
// This is a keyword and pattern filter, not an AI classifier, so it has
// zero latency and zero cost. Ambiguous messages pass through to the LLM
// because the system prompt handles them there.
// ---------------------------------------------------------------------------

// Topics that are clearly within scope.
// We err on the side of allowing ambiguous messages through.
const FOOD_KEYWORDS = [
  "food", "meal", "eat", "eating", "ate", "diet", "nutrition", "nutrient",
  "calorie", "calories", "protein", "carbs", "carbohydrate", "fat", "fibre",
  "fiber", "vitamin", "mineral", "weight", "health", "healthy", "recipe",
  "ingredient", "cook", "cooking", "breakfast", "lunch", "dinner", "snack",
  "drink", "water", "sugar", "sodium", "cholesterol", "portion", "serving",
  "hungry", "hunger", "fullness", "digest", "metabolism", "energy", "muscle",
  "lose weight", "gain weight", "blood sugar", "iron", "calcium", "omega",
  "vegetable", "fruit", "grain", "legume", "meat", "fish", "dairy", "egg",
  "jollof", "egusi", "suya", "amala", "eba", "fufu", "pounded yam", "ogbono",
  "afang", "banga", "rice", "beans", "yam", "plantain", "soup", "stew",
  "log", "logged", "track", "tracking", "dashboard", "goal", "target",
  "macro", "macros", "bmi", "body", "spin", "suggest", "suggestion",
];

// Patterns that are clearly off-topic regardless of what else is in the message.
const OFF_TOPIC_PATTERNS = [
  /\b(politics|election|president|government|war|news)\b/i,
  /\b(code|programming|software|javascript|python|typescript)\b/i,
  /\b(movie|film|music|song|actor|celebrity|sport|football|basketball)\b/i,
  /\b(math|algebra|geometry|calculus|equation|formula)\b/i,
  /\b(write me a|tell me a joke|poem|story|essay)\b/i,
  /\b(capital of|history of|what is the|who invented|wikipedia)\b/i,
];

export interface GuardResult {
  allowed: boolean;
  reason?: string;
}

export const checkMessageDomain = (message: string): GuardResult => {
  const lower = message.toLowerCase().trim();

  // Empty or very short messages pass through. the LLM handles them.
  if (lower.length < 3) {
    return { allowed: true };
  }

  // If message matches any hard off-topic pattern, block immediately.
  for (const pattern of OFF_TOPIC_PATTERNS) {
    if (pattern.test(lower)) {
      return {
        allowed: false,
        reason: "off-topic",
      };
    }
  }

  // If message contains at least one food or nutrition keyword, allow it.
  const hasFoodKeyword = FOOD_KEYWORDS.some((kw) => lower.includes(kw));
  if (hasFoodKeyword) {
    return { allowed: true };
  }

  // Message has no food keywords and no hard off-topic pattern. This is ambiguous. we allow it and let the system prompt handle it.
  return { allowed: true };
};

// ---------------------------------------------------------------------------
// The canned response sent back when the guard blocks a message.
// Friendly and redirects the user without making them feel punished.
// ---------------------------------------------------------------------------
export const OFF_TOPIC_RESPONSE =
  "I am your nutrition assistant and I can only help with food, meals, and diet-related questions. " +
  "Feel free to ask me about your meals, nutrition goals, or what to eat today.";