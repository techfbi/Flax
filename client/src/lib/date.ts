// Returns YYYY-MM-DD using LOCAL calendar fields, never UTC.
// Date.prototype.toISOString() is always UTC, which is wrong for "what
// day is it right now" in any timezone ahead of UTC, Nigeria included.
// This is the one place "what day is today" gets computed, every
// other file should call this instead of building its own date string.
export const getLocalDateStr = (date: Date = new Date()): string => {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
};