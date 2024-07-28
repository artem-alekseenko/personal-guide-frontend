export const useGuides = async () => {
  const { data, error } = await useFetch("/api/guides");

  if (error.value) {
    throw createError({
      ...error.value,
      statusMessage: `Could not fetch data about guides`,
    });
  }

  return data.value;
};
