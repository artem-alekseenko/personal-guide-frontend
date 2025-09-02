import type { IListOfTours } from "~/types";
import { useExternalApi } from "~/composables/server/useExternalApi";

export default defineEventHandler(async (event) => {
  const apiUrlForGettingTours = process.env.PG_API_LIST_TOURS_URL;

  if (!apiUrlForGettingTours) {
    console.error("External API URL for getting tours is not defined");
    return [];
  }

  try {
    const response = await useExternalApi<IListOfTours>(event, apiUrlForGettingTours);

    const { tours } = response;

    if (!tours || tours.length === 0) {
      return [];
    }

    return tours;
  } catch (error) {
    console.error("Failed to fetch data from external API", error);
    return [];
  }
});
