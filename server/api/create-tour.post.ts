import { useExternalApi } from "~/composables/server/useExternalApi";

export default defineEventHandler(async (event) => {
  const apiUrlForCreatingRoute = process.env.PG_API_CREATE_ROUTE_URL;

  if (!apiUrlForCreatingRoute) {
    console.error("External API URL for creating route is not defined");
    return;
  }

  const body = await readBody(event);

  try {
    return await useExternalApi(apiUrlForCreatingRoute, body, "POST");
  } catch (error) {
    console.error("Failed to fetch data from external API", error);
  }
});
