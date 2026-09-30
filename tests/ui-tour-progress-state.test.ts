import { expect, it, vi } from "vitest";
import { effectScope, ref, nextTick } from "vue";
import { useExperienceStore } from "../app/stores/experienceStore";
import { useTourProgress } from "../app/composables/tour/useTourProgress";
import type {
  ProgressRecord,
  ProgressTour,
} from "../shared/utils/tourProgress";

const tourData = (): ProgressTour => ({
  id: "tour",
  user_id: "owner",
  route: { points: [{ id: "square", name: "Square", lat: "47", lng: "19" }] },
  history: [],
});
it("follows live experience using Firebase identity rather than the backend owner ID", async () => {
  const store = useExperienceStore();
  const api = vi.fn();
  Object.assign(globalThis, { useNuxtApp: () => ({ $apiFetch: api }) });
  const firebaseUid = ref<string | null>("firebase-uid");
  const scope = effectScope();
  const progress = scope.run(() =>
    useTourProgress({
      tour: ref({ ...tourData(), user_id: "mongo-object-id" }),
      record: ref(null),
      liveExperience: { firebaseUid, viewFor: store.viewFor },
    }),
  )!;
  expect(progress.value?.latestText).toBeNull();
  api.mockResolvedValueOnce({
    revision: 1,
    stop_id: "square",
    stop_name: "Square",
    location_status: "USER_SELECTED",
    stops: [{ id: "square", name: "Square" }],
    turns: [
      {
        role: "guide",
        text: "A new live explanation.",
        created_at: "2026-09-30T13:00:00Z",
      },
    ],
  });
  await store.load("tour", "firebase-uid");
  expect(progress.value?.latestText).toBe("A new live explanation.");
  expect(progress.value?.locationLabel).toBe("selected");
  firebaseUid.value = "other-account";
  expect(progress.value?.latestText).toBeNull();
  scope.stop();
});
it("keeps the latest displayed guide text when the next update is empty", () => {
  const tour = ref<ProgressTour | null>(tourData());
  const record = ref<ProgressRecord | null>(null);
  const scope = effectScope();
  const progress = scope.run(() =>
    useTourProgress({ tour, record, view: ref(null) }),
  )!;
  record.value = {
    type: "SYSTEM_TEXT",
    message: "Our story here.",
    created_at: "2026-09-30T13:00:00Z",
    point: { lat: "47", lng: "19" },
  };
  expect(progress.value?.latestText).toBe("Our story here.");
  record.value = {
    type: "WAIT",
    message: "",
    created_at: "2026-09-30T13:01:00Z",
    point: { lat: "47.01", lng: "19.01" },
  };
  expect(progress.value?.latestText).toBe("Our story here.");
  expect(progress.value?.coordinates).toEqual({ lat: "47.01", lng: "19.01" });
  scope.stop();
});
it("clears remembered text across tour or account changes even if the old record remains", () => {
  const tour = ref<ProgressTour | null>(tourData());
  const record = ref<ProgressRecord | null>({
    type: "SYSTEM_TEXT",
    message: "Private old tour context",
  });
  const scope = effectScope();
  const progress = scope.run(() =>
    useTourProgress({ tour, record, view: ref(null) }),
  )!;
  expect(progress.value?.latestText).toBe("Private old tour context");
  tour.value = { ...tourData(), id: "other", user_id: "other-owner" };
  expect(progress.value?.latestText).toBeNull();
  record.value = { type: "SYSTEM_TEXT", message: "New owner's tour" };
  expect(progress.value?.latestText).toBe("New owner's tour");
  scope.stop();
});
it("restores the saved guide message on a fresh page instance without retaining it in browser storage", async () => {
  const tour = ref<ProgressTour | null>(null);
  const scope = effectScope();
  const progress = scope.run(() =>
    useTourProgress({ tour, record: ref(null), view: ref(null) }),
  )!;
  expect(progress.value).toBeNull();
  tour.value = {
    ...tourData(),
    history: [
      {
        type: "SYSTEM_TEXT",
        message: "Saved last words.",
        created_at: "2026-09-30T12:00:00Z",
      },
    ],
  };
  await nextTick();
  expect(progress.value?.latestText).toBe("Saved last words.");
  scope.stop();
});
