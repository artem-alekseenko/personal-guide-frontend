import type { IGuide } from "~/types/guides";

export const useGuides = async (): Promise<IGuide[]> => {
  const { data, error } = await useFetch<IGuide[]>("/api/guides");

  if (error.value) {
    throw createError({
      ...error.value,
      statusMessage: `Could not fetch data about guides`,
    });
  }

  return data.value as IGuide[];
};
