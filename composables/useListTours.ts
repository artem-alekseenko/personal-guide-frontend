import type { ICreatedTour } from "~/types";

export const useListTours = async (): Promise<ICreatedTour[]> => {
  try {
    const data = await $fetch<ICreatedTour[]>("/api/list-tours");
    return data;
  } catch (error) {
    throw createError({
      statusCode: (error as any)?.statusCode || 500,
      statusMessage: `Could not fetch data about tours: ${(error as any)?.message || 'Unknown error'}`,
    });
  }
};
