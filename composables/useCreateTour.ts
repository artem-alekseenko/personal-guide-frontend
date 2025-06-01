import type { ICreatedTour, ICreateTourRequest } from "~/types";

export const useCreateTour = async (
  params: ICreateTourRequest,
): Promise<ICreatedTour> => {
  try {
    const data = await $fetch<ICreatedTour>("/api/create-tour", {
      body: params,
      method: "POST",
    });

    if (!data) {
      throw new Error("Invalid response from the server");
    }

    return data;
  } catch (error) {
    throw createError({
      statusCode: (error as any)?.statusCode || 500,
      statusMessage: `Could not create a tour: ${(error as any)?.message || 'Unknown error'}`,
    });
  }
};
