import { create } from 'zustand'
import { tokenStore } from '@/lib/tokenStore'
import type { AuthUser } from '@/types/apiTypes'

interface AuthState {
  user: AuthUser | null
  isAuthenticated: boolean
  isLoading: boolean // true while GET /api/auth/me is in flight on app load

  setAuth: (user: AuthUser, accessToken: string) => void
  clearAuth: () => void
  setLoading: (loading: boolean) => void
}

export const useAuthStore = create<AuthState>((set) => ({
  user: null,
  isAuthenticated: false,
  isLoading: true, // start true — resolved after /me check on mount

  setAuth: (user, accessToken) => {
    tokenStore.set(accessToken)
    set({ user, isAuthenticated: true, isLoading: false })
  },

  clearAuth: () => {
    tokenStore.clear()
    set({ user: null, isAuthenticated: false, isLoading: false })
  },

  setLoading: (loading) => set({ isLoading: loading }),
}))