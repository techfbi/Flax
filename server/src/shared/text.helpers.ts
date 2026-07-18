// Reasoning capable models include their raw thinking process wrapped
// in think tags before the real answer. If the block is properly
// closed, strip it and keep what follows. If it is opened but never
// closed, the token budget ran out before a real answer was ever
// reached, there is nothing usable to return, treat it as empty so
// whatever called this can fall back correctly instead of trying to
// parse a truncated reasoning trace as if it were the real answer.
export const stripThinkTags = (text: string): string => {
  const closed = text.replace(/<think>[\s\S]*?<\/think>/gi, "").trim();
  if (closed) return closed;
  if (/<think>/i.test(text)) return "";
  return text.trim();
};