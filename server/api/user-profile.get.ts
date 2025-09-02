import type { IServerUserResponse } from "~/types";
import { useExternalApi } from "~/composables/server/useExternalApi";

export default defineEventHandler(async (event) => {
  const apiUrl = process.env.PG_API_GET_ME;

  if (!apiUrl) {
    throw createError({
      statusCode: 500,
      statusMessage: "API URL for getting user profile is not configured",
    });
  }

  try {
    const response = await useExternalApi<IServerUserResponse>(event, apiUrl);
    return response;
  } catch (error: any) {
    console.error("Error fetching user profile:", error);

    throw createError({
      statusCode: error.statusCode || 500,
      statusMessage: error.message || "Failed to fetch user profile",
    });
  }
});
