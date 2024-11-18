import type { Guide } from "~/types/guides";

export const useGuides = async (): Promise<Guide[]> => {
  const { data, error } = await useFetch<Guide[]>("/api/guides");

  if (error.value) {
    throw createError({
      ...error.value,
      statusMessage: `Could not fetch data about guides`,
    });
  }

  return data.value as Guide[];
};
