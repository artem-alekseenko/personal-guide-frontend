import type { IGuide, IGuidesResponse } from "~/types";
import { useExternalApi } from "~/composables/server/useExternalApi";
import { defineEventHandler } from "h3";

export default defineEventHandler(async (event): Promise<IGuide[]> => {
  const apiUrlForGettingGuides = process.env.PG_API_GUIDES_URL;

  if (!apiUrlForGettingGuides) {
    console.error("External API URL for getting guides is not defined");
    return [];
  }

  try {
    const response = await useExternalApi<IGuidesResponse>(
      event,
      apiUrlForGettingGuides,
    );

    const { guides } = response;

    if (!guides || guides.length === 0) {
      return [];
    }

    return guides;
  } catch (error) {
    console.error("Failed to fetch data from external API", error);
    return [];
  }
});
