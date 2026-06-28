/**
 * tokenStore. singleton that holds the JWT access token in memory only.
 * Never written to localStorage, sessionStorage, or cookies. Cleared on logout or on refresh failure.
 */

let accessToken: string | null = null

export const tokenStore = {
  get: (): string | null => accessToken,
  set: (token: string): void => { accessToken = token },
  clear: (): void => { accessToken = null },
}