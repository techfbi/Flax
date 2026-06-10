import { ChatSession } from "../../models/chat.model.js";
import { generateChatCompletion } from "../../config/ai.js";
import { pgPool } from "../../config/db.postgres.js";
import { AppError } from "../../shared/errors.js";

// Model sees 5 previous messages. Keeping this low saves TPM on the Groq free tier.
const CONTEXT_WINDOW = 5;

// ---------------------------------------------------------------------------
// buildSystemPrompt
// Constructs the system prompt injected at the start of every Groq call.
// ---------------------------------------------------------------------------
const buildSystemPrompt = async (userId: string): Promise<string> => {
  const result = await pgPool.query(
    `SELECT region, dietary_style, health_goal, allergies, calorie_target
     FROM health_profiles
     WHERE user_id = $1`,
    [userId]
  );

  const profile = result.rows[0];

  // the assistant still works and suggests the user completes their profile if no profile data is found.
  const profileSection = profile ? `User profile:
- Region: ${profile.region ?? "not set"}
- Health goal: ${profile.health_goal ?? "not set"}
- Dietary style: ${profile.dietary_style ?? "not set"}
- Allergies: ${Array.isArray(profile.allergies) && profile.allergies.length > 0 ? profile.allergies.join(", ") : "none"}
- Daily calorie target: ${profile.calorie_target ?? "not set"}`
    : "User profile: not yet completed. Gently encourage them to complete their health profile for personalised advice.";

  return `You are Noura. For context, your name is derived from "nourish" and "aura". You are a friendly and knowledgeable nutrition assistant inside the Nutridec app.
Your job is to help users with healthy food choices, meal nutrition, diet questions, and reaching their health goals.

${profileSection}

Rules you must follow:
1. Only answer questions about food, nutrition, meals, diet, and health goals. If asked about anything else, politely and dynamically say you can only help with nutrition topics.
2. Keep answers concise, warm, and practical. No long lectures.
3. Always respect the user's allergies. Never suggest a food that contains their allergens.
4. Personalise your answers using the user profile above where relevant.
5. Do not make medical diagnoses or prescribe treatments. You are a nutrition assistant, not a doctor.
6. Do not make up nutrition facts. If you are unsure, say so honestly.
7. If the user has not set a health profile, encourage them to do so once. Do not repeat it every message.`;
};

// ---------------------------------------------------------------------------
// getOrCreateSession
// Finds the existing chat session for this user or creates a new one.
// ---------------------------------------------------------------------------
const getOrCreateSession = async (userId: string) => {
  return ChatSession.findOneAndUpdate(
    { userId },
    { $setOnInsert: { userId, messages: [] } }, // setOnInsert only runs when a new document is being created and sets empty messages array on new doc but does nothing to existing doc.
    { upsert: true, new: true } // upsert: true; creates the document if it does not exist. new: true returns the updated document rather than the old one.
  );
};

// ---------------------------------------------------------------------------
// sendMessage
// The main function. handles a full user message turn
// ---------------------------------------------------------------------------
export const sendMessage = async ( userId: string, userMessage: string ): Promise<{ reply: string; modelUsed: string; isFallback: boolean }> => {

  const session = await getOrCreateSession(userId);

  // Append the new user message to the stored history.
  session.messages.push({
    role: "user",
    content: userMessage,
    createdAt: new Date(),
  });

  // Build the system prompt with live user profile data.
  const systemPrompt = await buildSystemPrompt(userId);

  // Slice the last CONTEXT_WINDOW messages for the model. (-5) to get the last 5 messages.
  const recentMessages = session.messages.slice(-CONTEXT_WINDOW);

  // The full messages array for the Groq API. System message always comes first. then the conversation history.
  const groqMessages: Array<{ role: "system" | "user" | "assistant"; content: string }> = [
    { role: "system", content: systemPrompt },
    ...recentMessages.map((m) => ({ role: m.role, content: m.content })),
  ];

  // Call Groq. the response text may be empty if both models failed.
  const { text, modelUsed, isFallback } = await generateChatCompletion(groqMessages);

  const reply =
    text ||
    "I am having trouble connecting right now. Please try again in a moment.";

  // Append the assistant reply to the session history.
  session.messages.push({
    role: "assistant",
    content: reply,
    createdAt: new Date(),
  });

  // Save the updated session with both the user message and assistant reply.
  await session.save();

  console.log(
    `[REMOVE LOG LATER] Chat message processed. user. ${userId}. model. ${modelUsed}. ` +
    `history length. ${session.messages.length}`
  );

  return { reply, modelUsed, isFallback };
};

// ---------------------------------------------------------------------------
// Returns all stored messages for the user's session.
// The frontend uses this to render the full conversation on load. Returns empty array if conversation dont exist yet
// ---------------------------------------------------------------------------
export const getChatHistory = async (userId: string): Promise<{
  messages: Array<{ role: string; content: string; createdAt: Date }>;
}> => {
  const session = await ChatSession.findOne({ userId }).lean();

  return {
    messages: session?.messages ?? [],
  };
};

// ---------------------------------------------------------------------------
// clearChatHistory
// Wipes all messages from the session document but keeps the document itself.
// ---------------------------------------------------------------------------
export const clearChatHistory = async (userId: string): Promise<void> => {
  await ChatSession.findOneAndUpdate(
    { userId },
    { $set: { messages: [] } }
  );

  console.log(`[REMOVE LOG LATER] Chat history cleared. user. ${userId}`);
};