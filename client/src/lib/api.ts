import axios, { type AxiosInstance, type InternalAxiosRequestConfig } from 'axios'
import { tokenStore } from './tokenStore'

declare module 'axios' {
  export interface InternalAxiosRequestConfig {
    _retried?: boolean
    _skipRefresh?: boolean
  }
}

/*
  Backend error codes that require navigation action.
  These come in the response body as { code: string }.

  Codes that send to /login?session=expired:
    TOKEN_EXPIRED  - access token expired (normal session end)
    TOKEN_REUSED   - refresh token reuse detected (security event)

  Codes that send to / (unauthenticated landing):
    NO_TOKEN       - no token sent after first refresh, user is not logged in
    INVALID_TOKEN  - malformed token, treat as unauthenticated

  Everything else (network errors, 5xx, etc.) does NOT navigate.
  Those fail silently per-request and the user sees a toast/error.
*/
const NAVIGATE_TO_EXPIRED = new Set(['TOKEN_EXPIRED', 'TOKEN_REUSED'])

let isRefreshing = false
let refreshQueue: Array<(token: string) => void> = []
let rejectQueue:  Array<(err: unknown) => void>  = []

const processQueue = (token: string) => {
  refreshQueue.forEach(cb => cb(token))
  refreshQueue = []
  rejectQueue  = []
}

const rejectAllQueued = (err: unknown) => {
  rejectQueue.forEach(cb => cb(err))
  refreshQueue = []
  rejectQueue  = []
}

const getErrorCode = (err: unknown): string | null => {
  return (
    (err as { response?: { data?: { code?: string } } })
      ?.response?.data?.code ?? null
  )
}

const api: AxiosInstance = axios.create({
  baseURL: import.meta.env.VITE_API_BASE_URL ?? 'http://localhost:3000',
  withCredentials: true,
  headers: { 'Content-Type': 'application/json' },
})

/* Attach access token to every request */
api.interceptors.request.use((config: InternalAxiosRequestConfig) => {
  const token = tokenStore.get()
  if (token && config.headers) {
    config.headers.Authorization = `Bearer ${token}`
  }
  return config
})

api.interceptors.response.use(
  (response) => response,
  async (error) => {
    const original = error.config as InternalAxiosRequestConfig;

    // ============================================================
    // 1. NETWORK ERROR. no response from server at all.
    //    Do NOT navigate. Do NOT refresh. Just reject silently.
    //    The calling component shows "Something went wrong".
    // ============================================================
    if (!error.response) {
      return Promise.reject(error);
    }

    // ============================================================
    // 2. Skip refresh if:
    //    - Already retried
    //    - _skipRefresh flag is set
    //    - The failed request is the refresh endpoint itself
    // ============================================================
    if (
      original._retried ||
      original._skipRefresh ||
      original.url === '/api/auth/refresh'
    ) {
      return Promise.reject(error);
    }

    // ============================================================
    // 3. Only handle 401 Unauthorized
    //    Any 401 → attempt refresh silently.
    //    NO_TOKEN, INVALID_TOKEN, TOKEN_EXPIRED, TOKEN_REUSED all
    //    go through the same flow, try refresh first.
    // ============================================================
    if (error.response.status !== 401) {
      return Promise.reject(error);
    }

    // ============================================================
    // 4. Queue mechanism if refresh is already in flight
    // ============================================================
    if (isRefreshing) {
      return new Promise((resolve, reject) => {
        refreshQueue.push((token: string) => {
          original.headers = original.headers ?? {};
          original.headers.Authorization = `Bearer ${token}`;
          resolve(api(original));
        });
        rejectQueue.push(reject);
      });
    }

    // ============================================================
    // 5. Attempt refresh
    // ============================================================
    original._retried = true;
    isRefreshing = true;

    try {
      const { data } = await api.post<{ data: { accessToken: string } }>(
        '/api/auth/refresh',
        {},
        { _skipRefresh: true } as InternalAxiosRequestConfig
      );

      const newToken = data.data.accessToken;
      tokenStore.set(newToken);
      processQueue(newToken);
      isRefreshing = false;

      // Retry the original request with the new token
      original.headers = original.headers ?? {};
      original.headers.Authorization = `Bearer ${newToken}`;
      return api(original);

    } catch (refreshError: unknown) {
      // ============================================================
      // 6. Refresh FAILED, clean up and decide what to do
      // ============================================================
      isRefreshing = false;
      tokenStore.clear();
      rejectAllQueued(refreshError);

      // 6a. Network error during refresh, DO NOT NAVIGATE.
      //     Stay on current page, reject silently.
      if (!(refreshError as { response?: unknown })?.response) {
        return Promise.reject(refreshError);
      }

      // 6b. Server responded to the refresh request.
      //     Now we check the error code and navigate ONLY if it's an auth failure.
      const refreshCode = getErrorCode(refreshError);
      console.log("The refresh code is ", refreshCode);

      // SMART REDIRECT: Only redirect if NOT already on a login page
      const isOnLoginPage = [
        '/',
        '/login',
        '/register',
        '/verify-otp',
        '/forgot-password',
        '/reset-password',
        '/auth/callback',
      ].includes(window.location.pathname);

      // TOKEN_REUSED or TOKEN_EXPIRED → session expired → go to login
      if (refreshCode && NAVIGATE_TO_EXPIRED.has(refreshCode)) {
        if (!isOnLoginPage) {
          window.location.replace('/login?session=expired');
        }
        // If already on a login page, stay there – no loop
        return Promise.reject(refreshError);
      }

      // NO_TOKEN or INVALID_TOKEN → genuinely not logged in → go to landing.
      // Anything else, an unrecognized 5xx or a response shape with no
      // code at all, is not a confirmed auth failure, fail silently
      // instead, matching the contract documented at the top of this file.
      const NOT_LOGGED_IN_CODES = new Set(['NO_TOKEN', 'INVALID_TOKEN']);
      if (refreshCode && NOT_LOGGED_IN_CODES.has(refreshCode)) {
        if (!isOnLoginPage) {
          window.location.replace('/');
        }
        return Promise.reject(refreshError);
      }
      return Promise.reject(refreshError);
    }
  }
);

export default api