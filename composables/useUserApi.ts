import type { IServerUserResponse } from "~/types";

export const useUserApi = () => {
  const nuxtApp = useNuxtApp();
  const apiFetch = (nuxtApp.$apiFetch ?? $fetch) as typeof $fetch;

  if (!("$apiFetch" in nuxtApp) && import.meta.dev) {
    console.warn(
      "[useUserApi] $apiFetch is not ready yet, falling back to $fetch (no Authorization header).",
    );
  }
  
  /**
   * Fetch user profile from server
   */
  const fetchUserProfile = async (): Promise<IServerUserResponse> => {
    try {
      const response = await apiFetch<IServerUserResponse>("/api/user-profile");
      return response;
    } catch (error: any) {
      console.error("Error fetching user profile:", error);
      throw createError({
        statusCode: error.statusCode || 500,
        statusMessage: error.message || "Failed to fetch user profile",
      });
    }
  };

  /**
   * Update user profile on server
   */
  const updateUserProfile = async (
    name: string,
    language: string,
  ): Promise<IServerUserResponse> => {
    try {
      const response = await apiFetch<IServerUserResponse>("/api/user-profile", {
        method: "PUT",
        body: {
          name,
          language,
        },
      });
      return response;
    } catch (error: any) {
      console.error("Error updating user profile:", error);
      throw createError({
        statusCode: error.statusCode || 500,
        statusMessage: error.message || "Failed to update user profile",
      });
    }
  };

  return {
    fetchUserProfile,
    updateUserProfile,
  };
}; 