import axios, { type AxiosInstance, type InternalAxiosRequestConfig } from 'axios'
import { tokenStore } from './tokenStore'

/**
 * Single Axios instance for all API calls.
 * - Attaches in-memory access token to every request. On 401: attempts one silent token refresh, then retries original request.
 * - On refresh failure: clears token. Does NOT redirect — the router handles that.
 * - Requests marked with _skipRefresh bypass the interceptor entirely.  Used for the app-load /me check and the refresh call itself.
 */

// Extend AxiosRequestConfig to support our custom flags
declare module 'axios' {
  export interface InternalAxiosRequestConfig {
    _retried?: boolean
    _skipRefresh?: boolean
  }
}

let isRefreshing = false
let refreshQueue: Array<(token: string) => void> = []

const processQueue = (token: string) => {
  refreshQueue.forEach(cb => cb(token))
  refreshQueue = []
}

const clearQueue = () => {
  refreshQueue = []
}

const api: AxiosInstance = axios.create({
  baseURL: import.meta.env.VITE_API_BASE_URL ?? 'http://localhost:3000',
  withCredentials: true,
  headers: { 'Content-Type': 'application/json' },
})

// ── Request interceptor: attach access token ─────────────────
api.interceptors.request.use((config: InternalAxiosRequestConfig) => {
  const token = tokenStore.get()
  if (token && config.headers) {
    config.headers.Authorization = `Bearer ${token}`
  }
  return config
})

// ── Response interceptor: handle 401 with one silent retry ───
api.interceptors.response.use(
  response => response,
  async error => {
    const original = error.config as InternalAxiosRequestConfig

    // Skip refresh logic entirely for:
    // 1. Non-401 errors
    // 2. Requests already retried
    // 3. Requests explicitly marked to skip (app-load /me check)
    if (
      error.response?.status !== 401 ||
      original._retried ||
      original._skipRefresh
    ) {
      return Promise.reject(error)
    }

    original._retried = true

    if (isRefreshing) {
      // Queue this request until in-flight refresh completes
      return new Promise((resolve, reject) => {
        refreshQueue.push((token: string) => {
          original.headers = original.headers ?? {}
          original.headers.Authorization = `Bearer ${token}`
          resolve(api(original))
        })
        // If refresh fails, reject queued requests too
        setTimeout(() => reject(error), 10000)
      })
    }

    isRefreshing = true

    try {
      // Mark the refresh call itself to skip this interceptor
      const { data } = await api.post<{ data: { accessToken: string } }>(
        '/api/auth/refresh',
        {},
        { _skipRefresh: true } as InternalAxiosRequestConfig
      )
      const newToken = data.data.accessToken
      tokenStore.set(newToken)
      processQueue(newToken)

      original.headers = original.headers ?? {}
      original.headers.Authorization = `Bearer ${newToken}`
      return api(original)
    } catch {
      // Refresh failed — clear everything.
      // Do NOT redirect here. The router's auth guard handles redirect.
      tokenStore.clear()
      clearQueue()
      return Promise.reject(error)
    } finally {
      isRefreshing = false
    }
  }
)

export default api