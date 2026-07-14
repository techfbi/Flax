import api from '@/lib/api'
import { tokenStore } from '@/lib/tokenStore'
import { useAuthStore } from '@/store/authStore'
import type { ApiResponse, FullProfile } from '@/types/apiTypes'

/**
  Resolves the correct post-auth route by checking the users health profile.
  Call this BEFORE setAuth so the token is available for the request
  but the store has not set isAuthenticated yet, preventing any route render.

  Returns '/onboarding' if health profile is incomplete.
  Returns '/' (homepage)if health profile exists and has a goal set.
*/
export const resolvePostAuthRoute = async (
  accessToken: string
): Promise<'/' | '/onboarding'> => {
  tokenStore.set(accessToken)
  try {
    const { data } = await api.get<ApiResponse<{ profile: FullProfile }>>(
      '/api/users/profile'
    )
    const profile = data.data.profile

    /* Store avatar while we have the profile */
    useAuthStore.getState().setAvatarUrl(profile.avatar_url)

    if (!profile.health || !profile.health.region) {
      return '/onboarding'
    }
    return '/'
  } catch {
    return '/onboarding'
  }
}