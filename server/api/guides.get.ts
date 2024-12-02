import type { Guide, IGuidesResponse } from "~/types/guides.ts";
import { useExternalApi } from "~/composables/server/useExternalApi";
import { defineEventHandler } from "h3";

export default defineEventHandler(async (): Promise<Guide[]> => {
  const apiUrlForGettingGuides = process.env.PG_API_GUIDES_URL;

  if (!apiUrlForGettingGuides) {
    console.error("External API URL for getting guides is not defined");
    return [];
  }

  const response = await useExternalApi<IGuidesResponse | Error>(
    apiUrlForGettingGuides,
  ).catch((e) => e as Error);

  if (response instanceof Error) {
    console.error("Failed to fetch data from external API", response.message);

    return [];
  }

  const { guides } = response;

  if (!guides.length) return [];

  return guides.map((guide: Guide) => ({
    id: guide.id,
    context: guide.context,
    name: guide.name,
    tags: guide.tags,
    skills: guide.skills,
    avatar: guide.avatar,
    tours: guide.tours,
  }));
});
