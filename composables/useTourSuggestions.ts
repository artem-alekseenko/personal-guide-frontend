import type {
  IRouteSuggestionsParams,
  IRouteSuggestionsResponseExtended,
} from "~/types";

export const useTourSuggestions = async (
  params: IRouteSuggestionsParams,
): Promise<IRouteSuggestionsResponseExtended> => {
  try {
    const data = await $fetch<IRouteSuggestionsResponseExtended>(
      "api/route-suggestions",
      { query: params },
    );

    if (!data) {
      throw createError({
        statusCode: 500,
        statusMessage: "No tour suggestions returned from the API",
      });
    }

    return data;
  } catch (error) {
    throw createError({
      statusCode: (error as any)?.statusCode || 500,
      statusMessage: `Could not fetch data about route suggestions: ${(error as any)?.message || 'Unknown error'}`,
    });
  }
};
