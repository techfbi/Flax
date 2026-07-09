import { useQuery } from "@tanstack/react-query";
import api from "@/lib/api";
import type { ApiResponse, FullProfile } from "@/types/apiTypes";

// Shared profile query, used by ProfilePage, SettingsPage, and SpinTab
// (for the user's real allergy list). Same query key everywhere so
// they all read from one cache instead of firing separate requests.
export const useUserProfile = () =>
  useQuery({
    queryKey: ["user-profile"],
    queryFn: async () => {
      const { data } = await api.get<ApiResponse<{ profile: FullProfile }>>(
        "/api/users/profile",
      );
      return data.data.profile;
    },
    staleTime: 5 * 60 * 1000,
  });