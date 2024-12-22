import { useFetch } from "#imports";
import type {
  IRouteSuggestionsParams,
  IRouteSuggestionsResponseExtended,
} from "~/types";

export const useTourSuggestions = async (
  params: IRouteSuggestionsParams,
): Promise<IRouteSuggestionsResponseExtended> => {
  const { data, error } = await useFetch<IRouteSuggestionsResponseExtended>(
    "api/route-suggestions",
    { query: params },
  );

  if (error.value) {
    throw createError({
      ...error.value,
      statusMessage: `Could not fetch data about route suggestions`,
    });
  }

  if (!data.value) {
    throw createError({
      statusCode: 500,
      statusMessage: "No tour suggestions returned from the API",
    });
  }

  return data.value;
};
