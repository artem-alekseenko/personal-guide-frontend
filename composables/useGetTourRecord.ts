import type {
  ITourRecord,
  ITourRecordRequest,
  ITourRecordResponse,
} from "~/types";

export const useGetTourRecord = async (
  tourId: string,
  params: ITourRecordRequest,
): Promise<ITourRecord> => {
  try {
    const data = await $fetch<ITourRecordResponse>(
      `/api/get-tour-record/${tourId}`,
      {
        body: params,
        method: "POST",
      },
    );

    if (!data) {
      throw new Error(
        "Invalid response for getting tour record from the server",
      );
    }

    return data.record as ITourRecord;
  } catch (error) {
    if (error instanceof Error) {
      throw createError({
        statusMessage: `Could not fetch data about the tour record`,
        statusCode: (error as any).statusCode || 500,
        data: (error as any).data || {},
      });
    } else {
      throw createError({
        statusMessage: `An unknown error occurred when fetching data about the tour record`,
        statusCode: 500,
        data: {},
      });
    }
  }
};
