import type { ICreatedTour, ICreateTourRequest } from "~/types";

export const useCreateTour = async (
  params: ICreateTourRequest,
): Promise<ICreatedTour> => {
  const { data, error } = await useFetch("/api/create-tour", {
    body: params,
    method: "POST",
  });

  if (error.value) {
    throw createError({
      ...error.value,
      statusMessage: `Could not create a tour`,
    });
  }

  if (!data.value) {
    throw new Error("Invalid response from the server");
  }

  return data.value as ICreatedTour;
};
