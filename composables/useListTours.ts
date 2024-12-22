import type { ICreatedTour } from "~/types";

export const useListTours = async (): Promise<ICreatedTour[]> => {
  const { data, error } = await useFetch<ICreatedTour[]>("/api/list-tours");

  if (error.value) {
    throw createError({
      ...error.value,
      statusMessage: `Could not fetch data about tours`,
    });
  }

  return data.value as ICreatedTour[];
};
