import type { IServerUserResponse } from "~/types";
import { useExternalApi } from "~/composables/server/useExternalApi";

export default defineEventHandler(async (event) => {
  const apiUrl = process.env.PG_API_UPDATE_ME;

  if (!apiUrl) {
    throw createError({
      statusCode: 500,
      statusMessage: "API URL for update user profile is not configured",
    });
  }

  try {
    const body = await readBody(event);

    if (!body || typeof body !== "object") {
      throw createError({
        statusCode: 400,
        statusMessage: "Invalid request body",
      });
    }

    const { name, language } = body;

    if (!name || !language) {
      throw createError({
        statusCode: 400,
        statusMessage: "Name and language are required",
      });
    }

    const requestParams = {
      name: String(name),
      language: String(language),
    };

    const response = await useExternalApi<IServerUserResponse>(
      apiUrl,
      requestParams,
      "PUT",
    );

    return response;
  } catch (error: any) {
    console.error("Error updating user profile:", error);

    throw createError({
      statusCode: error.statusCode || 500,
      statusMessage: error.message || "Failed to update user profile",
    });
  }
});
