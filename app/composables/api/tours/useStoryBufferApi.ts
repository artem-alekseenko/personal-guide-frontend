import { useTourRequestStore } from "~/stores/tourRequestStore";
import { useUserStore } from "~/stores/userStore";
import type {
  StoryBufferState,
  StoryBufferView,
} from "#shared/types/storyBuffer";
import type { StoryBufferTransport } from "#shared/utils/storyBuffer";

export function useStoryBufferApi(
  tourId: string,
  uid: string,
): StoryBufferTransport {
  const api = useNuxtApp().$apiFetch as typeof $fetch;
  const requests = useTourRequestStore();
  const base = `/api/story-buffer/${encodeURIComponent(tourId)}`;
  const send = <T>(suffix: string, body?: object, key?: string) => {
    const request = () => {
      if (useUserStore().user?.uid !== uid)
        throw new Error("The signed-in account changed");
      return api<T>(`${base}${suffix}`, {
        method: body ? "POST" : "GET",
        ...(body ? { body } : {}),
        retry: 0,
        ...(key ? { headers: { "Idempotency-Key": key } } : {}),
      });
    };
    // Metadata reads cannot supersede a segment and must not block controls.
    return body ? requests.run(tourId, request) : request();
  };
  return {
    prepare: (body, key) => send<StoryBufferView>("/prepare", body, key),
    activate: (id, body, key) =>
      send<StoryBufferView>(`/${encodeURIComponent(id)}/activate`, body, key),
    cancel: (body) => send<StoryBufferView>("/cancel", body),
    state: () => send<StoryBufferState>(""),
  };
}
