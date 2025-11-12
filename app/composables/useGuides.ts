import type { IGuide } from "~/types";

export const useGuides = async (): Promise<IGuide[]> => {
  const { $apiFetch } = useNuxtApp();
  const apiFetch = $apiFetch as typeof $fetch;
  
  try {
    const data = await apiFetch<IGuide[]>("/api/guides");
    return data;
  } catch (error) {
    throw createError({
      statusCode: (error as any)?.statusCode || 500,
      statusMessage: `Could not fetch data about guides: ${(error as any)?.message || 'Unknown error'}`,
    });
  }
};
