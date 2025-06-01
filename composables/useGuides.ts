import type { IGuide } from "~/types";

export const useGuides = async (): Promise<IGuide[]> => {
  try {
    const data = await $fetch<IGuide[]>("/api/guides");
    return data;
  } catch (error) {
    throw createError({
      statusCode: (error as any)?.statusCode || 500,
      statusMessage: `Could not fetch data about guides: ${(error as any)?.message || 'Unknown error'}`,
    });
  }
};
