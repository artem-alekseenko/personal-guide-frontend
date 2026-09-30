import type { IServerUserResponse } from "~/types";
import type { PersonalContext } from "~/types/personalContext";

export const useUserApi = () => {
  const apiFetch = useNuxtApp().$apiFetch as typeof $fetch;

  /**
   * Fetch user profile from server
   */
  const fetchUserProfile = async (): Promise<IServerUserResponse> => {
    try {
      const response = await apiFetch<IServerUserResponse>("/api/user-profile");
      return response;
    } catch (error: any) {
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
    personalContext?: PersonalContext | null,
  ): Promise<IServerUserResponse> => {
    try {
      const response = await apiFetch<IServerUserResponse>(
        "/api/user-profile",
        {
          method: "PUT",
          body: {
            name,
            language,
            ...(personalContext !== undefined
              ? { personal_context: personalContext }
              : {}),
          },
        },
      );
      return response;
    } catch (error: any) {
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
