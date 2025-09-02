import type { ICreatedTour } from "~/types";

export const useGetTour = async (tourId: string): Promise<ICreatedTour> => {
  const { $apiFetch } = useNuxtApp();
  const apiFetch = $apiFetch as typeof $fetch;
  
  try {
    const data = await apiFetch<ICreatedTour>(`/api/get-tour/${tourId}`);
    return data;
  } catch (error) {
    throw createError({
      statusCode: (error as any)?.statusCode || 500,
      statusMessage: `Could not fetch data about tour: ${(error as any)?.message || 'Unknown error'}`,
    });
  }
};
