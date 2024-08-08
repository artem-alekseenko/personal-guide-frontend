import { useExternalApi } from "~/composables/server/useExternalApi";
import { Guide } from "~/types/guides";

export default defineEventHandler(async (event): Promise<Guide[]> => {
  const externalApiUrl = "https://api.personal-guide.ai/guides/";

  let guides = [] as Guide[];

  try {
    const response = await useExternalApi<Guide[]>(externalApiUrl);
    guides = response.guides;
  } catch (error) {
    console.error("Failed to fetch data from external API", error);
  }

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
