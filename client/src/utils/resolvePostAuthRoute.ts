import api from '@/lib/api'
import { tokenStore } from '@/lib/tokenStore'
import type { ApiResponse, FullProfile } from '@/types/apiTypes'

/**
  Resolves the correct post-auth route by checking the users health profile.
  Call this BEFORE setAuth so the token is available for the request
  but the store has not set isAuthenticated yet, preventing any route render.

  Returns '/onboarding' if health profile is incomplete.
  Returns '/dashboard' if health profile exists and has a goal set.
*/
export const resolvePostAuthRoute = async (
  accessToken: string
): Promise<'/onboarding' | '/dashboard'> => {
  tokenStore.set(accessToken)
  try {
    const { data } = await api.get<ApiResponse<{ profile: FullProfile }>>(
      '/api/users/profile'
    )
    const health = data.data.profile.health
    if (!health || !health.health_goal) {
      return '/onboarding'
    }
    return '/dashboard'
  } catch {
    return '/onboarding'
  }
}