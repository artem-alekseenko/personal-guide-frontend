import type { ICreatedTour } from "~/types";

export const useListTours = async (query: {
  skip: number;
  limit: number;
}): Promise<ICreatedTour[]> => {
  const { $apiFetch } = useNuxtApp();
  const apiFetch = $apiFetch as typeof $fetch;

  try {
    const data = await apiFetch<ICreatedTour[]>("/api/list-tours", { query });
    return data;
  } catch (error) {
    throw createError({
      statusCode: (error as any)?.statusCode || 500,
      statusMessage: `Could not fetch data about tours: ${(error as any)?.message || "Unknown error"}`,
    });
  }
};
