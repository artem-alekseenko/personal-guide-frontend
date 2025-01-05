import type { ICreatedTour } from "~/types";

export const useGetTour = async (tourId: string): Promise<ICreatedTour> => {
  const { data, error } = await useFetch<ICreatedTour>(
    `/api/get-tour/${tourId}`,
  );

  if (error.value) {
    throw createError({
      ...error.value,
      statusMessage: `Could not fetch data about tour`,
    });
  }

  return data.value as ICreatedTour;
};
