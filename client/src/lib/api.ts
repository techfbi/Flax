import axios, { type AxiosError, type InternalAxiosRequestConfig } from "axios";
import { tokenStore } from "./tokenstore"; 

// Always import { api } from "@/lib/api".
export const api = axios.create({
  baseURL: `${import.meta.env.VITE_API_URL}/api`,
  withCredentials: true, // sends the httpOnly refresh cookie on every request
  headers: {
    "Content-Type": "application/json",
  },
});

// ---------------------------------------------------------------------------
// Request interceptor
// Attaches the in-memory access token to every outgoing request.
// If no token exists the request goes out without Authorization header. The backend will return 401 which the response interceptor handles.
// ---------------------------------------------------------------------------
api.interceptors.request.use((config: InternalAxiosRequestConfig) => {
  const token = tokenStore.get();
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

// ---------------------------------------------------------------------------
// Track whether a token refresh is already in flight.
// If multiple requests 401 simultaneously, we only call /refresh once and queue the others to retry after the new token arrives.
// Without this, we'd fire multiple refresh calls and the second one would fail because the first already rotated the refresh cookie.
// ---------------------------------------------------------------------------
let isRefreshing = false;
let refreshQueue: Array<{
  resolve: (token: string) => void;
  reject: (err: unknown) => void;
}> = [];

const processQueue = (error: unknown, token: string | null) => {
  refreshQueue.forEach(({ resolve, reject }) => {
    if (error) reject(error);
    else resolve(token!);
  });
  refreshQueue = [];
};

// ---------------------------------------------------------------------------
// Response interceptor
// Catches 401 responses, attempts a silent token refresh, then retries the original request with the new token. One retry only.
// If refresh fails, clears the token and redirects to login.
// ---------------------------------------------------------------------------
api.interceptors.response.use(
  (response) => response,

  async (error: AxiosError) => {
    const original = error.config as InternalAxiosRequestConfig & {
      _retry?: boolean;
    };

    // Only attempt refresh on 401 and only if we haven't already retried
    if (error.response?.status !== 401 || original._retry) {
      return Promise.reject(error);
    }

    // Don't retry the refresh endpoint itself (prevents infinite loop)
    if (original.url?.includes("/auth/refresh")) {
      tokenStore.clear();
      window.location.href = "/login";
      return Promise.reject(error);
    }

    // If a refresh is already in flight, queue this request
    if (isRefreshing) {
      return new Promise((resolve, reject) => {
        refreshQueue.push({ resolve, reject });
      }).then((token) => {
        original.headers.Authorization = `Bearer ${token}`;
        return api(original);
      });
    }

    original._retry = true;
    isRefreshing = true;

    try {
      // The refresh cookie is sent automatically via withCredentials: true
      const { data } = await api.post<{
        data: { tokens: { accessToken: string } };
      }>("/auth/refresh");

      const newToken = data.data.tokens.accessToken;
      tokenStore.set(newToken);
      processQueue(null, newToken);

      original.headers.Authorization = `Bearer ${newToken}`;
      return api(original);
    } catch (refreshError) {
      processQueue(refreshError, null);
      tokenStore.clear();
      // Hard redirect so all React state is cleared cleanly
      window.location.href = "/login";
      return Promise.reject(refreshError);
    } finally {
      isRefreshing = false;
    }
  }
);