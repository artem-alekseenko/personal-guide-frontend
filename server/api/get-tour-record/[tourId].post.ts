import { useExternalApi } from "~/composables/server/useExternalApi";

export default defineEventHandler(async (event) => {
  const params = event.context.params;

  if (!params) {
    throw new Error("Params are not defined");
  }
  const { tourId } = params as Record<string, string>;

  if (!process.env.PG_API_CREATE_ROUTE_URL) {
    console.error("External API URL for getting tour record is not defined");
    return;
  }

  const apiUrlForGettingTourRecord = `${process.env.PG_API_CREATE_ROUTE_URL}${tourId}/next`;

  const body = await readBody(event);

  try {
    return await useExternalApi(event, apiUrlForGettingTourRecord, body, "POST");
  } catch (error) {
    console.error("Failed to fetch data from external", error);
  }
});
