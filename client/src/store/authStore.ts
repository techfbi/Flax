import { create } from 'zustand'
import { tokenStore } from '@/lib/tokenStore'
import type { AuthUser } from '@/types/apiTypes'

interface AuthState {
  user: AuthUser | null
  isAuthenticated: boolean
  isLoading: boolean
  /*
    pendingNavigation: true while we are resolving the post auth route.
    Prevents PublicRoute from firing its own redirect to /dashboard
    while resolvePostAuthRoute is in flight after setAuth is called.
  */
  pendingNavigation: boolean

  setAuth: (user: AuthUser, accessToken: string) => void
  setUser: (user: AuthUser) => void
  clearAuth: () => void
  setLoading: (loading: boolean) => void
  setPendingNavigation: (pending: boolean) => void
}

export const useAuthStore = create<AuthState>((set) => ({
  user: null,
  isAuthenticated: false,
  isLoading: true,
  pendingNavigation: false,

  setAuth: (user, accessToken) => {
    tokenStore.set(accessToken)
    set({ user, isAuthenticated: true, isLoading: false })
  },

  setUser: (user) => {
    set({ user, isAuthenticated: true, isLoading: false })
  },

  clearAuth: () => {
    tokenStore.clear()
    set({ user: null, isAuthenticated: false, isLoading: false, pendingNavigation: false })
  },

  setLoading: (loading) => set({ isLoading: loading }),

  setPendingNavigation: (pending) => set({ pendingNavigation: pending }),
}))