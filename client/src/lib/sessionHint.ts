/*
  sessionHint. A non sensitive "this browser was signed in" marker.

  It is NOT a credential and grants nothing, the real session is still
  the httpOnly refresh cookie plus the in memory access token. Its only
  job is letting the public homepage at "/", which is server rendered
  and never calls the API, send a returning signed in user straight to
  /home, the way the old SPA root route did.

  Search engine crawlers never have it, so they always see the landing
  page and are never redirected, which is what makes "/" indexable.

  Set whenever the app confirms a session, cleared whenever the app
  drops one. If it is ever stale, /home simply runs the normal session
  check, which clears it and lands on login or the homepage, and the
  homepage's loop guard stops it from redirecting twice in a row.
*/
const KEY = "flax-has-session";

export const sessionHint = {
  set: (): void => {
    try {
      localStorage.setItem(KEY, "1");
    } catch {
      // storage unavailable, the homepage just will not auto redirect
    }
  },
  clear: (): void => {
    try {
      localStorage.removeItem(KEY);
    } catch {
      // storage unavailable, nothing to clear
    }
  },
  has: (): boolean => {
    try {
      return localStorage.getItem(KEY) === "1";
    } catch {
      return false;
    }
  },
};
