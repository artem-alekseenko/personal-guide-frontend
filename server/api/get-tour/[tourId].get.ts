import { useExternalApi } from "~/composables/server/useExternalApi";
import type { ICreatedTour } from "~/types";

export default defineEventHandler(async (event) => {
  const params = event.context.params;

  if (!params) {
    throw new Error("Params are not defined");
  }

  const { tourId } = params;
  const apiUrlForGettingTour = `${process.env.PG_API_LIST_TOURS_URL}${tourId}`;
  try {
    const response = await useExternalApi<ICreatedTour>(apiUrlForGettingTour);

    return response;
  } catch (error) {
    console.error("Failed to fetch data from external API", error);
    return [];
  }
});
