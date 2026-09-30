import { useTourRequestStore } from "~/stores/tourRequestStore";
import { useExperienceStore } from "~/stores/experienceStore";
import type {
  ITourRecord,
  ITourRecordRequest,
  ITourRecordResponse,
} from "~/types";

export const useGetTourRecord = async (
  tourId: string,
  params: ITourRecordRequest,
  operationId: string = crypto.randomUUID(),
): Promise<ITourRecord> => {
  const { $apiFetch } = useNuxtApp();
  const apiFetch = $apiFetch as typeof $fetch;

  try {
    const data = await useTourRequestStore().run(tourId, () => {
      const request = () =>
        apiFetch<ITourRecordResponse>(
          `/api/get-tour-record/${encodeURIComponent(tourId)}`,
          {
            body: params,
            method: "POST",
            retry: 0,
            headers: { "Idempotency-Key": operationId },
          },
        );
      // Commands can persist before the rest of /next succeeds. Read text state
      // before releasing the shared queue so the next text mutation uses its revision.
      return params.user_text?.trim()
        ? useExperienceStore().withCommand(tourId, request)
        : request();
    });

    if (!data) {
      throw new Error(
        "Invalid response for getting tour record from the server",
      );
    }

    return {
      ...data.record,
      places: data.places,
      audio_data: data.audio_data,
      route_points: data.route_points,
    };
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
