// In-memory access token store. This is a module-level singleton.
// The token lives here and nowhere else, never in localStorage, never in sessionStorage, never in a React state variable.
//
// This singleton module is evaluated once and its exports are cached by the JS engine. Every import of this module gets the
// same object reference, so the token is shared across the whole app without needing React Context or a global variable on window.

let accessToken: string | null = null;

export const tokenStore = {
  get: (): string | null => accessToken,

  set: (token: string): void => {
    accessToken = token;
  },

  clear: (): void => {
    accessToken = null;
  },

  // Convenience for checking auth state synchronously anywhere, including inside the Axios interceptor where hooks cannot be used.
  isAuthenticated: (): boolean => accessToken !== null,
};