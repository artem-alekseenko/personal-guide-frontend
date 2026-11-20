import { computed, onScopeDispose, shallowRef, watch, type Ref } from "vue";
import type { ICreatedTour } from "~/types";
import type { WalkKnowledge } from "#shared/types/nativeWalk";
import { useUserStore } from "~/stores/userStore";

export function isProvisionalWalkTitle(name?: string) {
  const title = name?.trim();
  return !title || /^\d+-minute walk$/.test(title);
}

/** Read saved route identities; opening a card never starts research or playback. */
export function useNativeWalkPresentation(tour: Readonly<Ref<ICreatedTour>>) {
  const users = useUserStore();
  const { $apiFetch } = useNuxtApp();
  const { t } = useI18n();
  const knowledge = shallowRef<WalkKnowledge | null>(null);
  let epoch = 0;
  watch(
    [
      () => users.user?.uid,
      () => tour.value.user_id,
      () => tour.value.id,
      () => tour.value.playback_generation_id,
      () => tour.value.route.walking_plan?.revision,
      () => tour.value.route.walking_plan?.intent?.language,
    ] as const,
    async ([uid, owner, id, generation, revision, language], previous) => {
      const request = ++epoch;
      knowledge.value = null;
      if (
        !uid ||
        !owner ||
        !generation ||
        !revision ||
        !language ||
        (previous?.[0] && previous[0] !== uid)
      )
        return;
      try {
        const result = await ($apiFetch as typeof $fetch)<WalkKnowledge>(
          `/api/native-walk/${encodeURIComponent(id)}/knowledge`,
        );
        if (
          request === epoch &&
          result.generation_id === generation &&
          result.route_revision === revision &&
          result.language === language
        )
          knowledge.value = result;
      } catch {
        // Presentation is optional; a metadata read failure must not block walking.
      }
    },
    { immediate: true, flush: "sync" },
  );
  onScopeDispose(() => {
    epoch++;
  });
  const title = computed(() => {
    const original = tour.value.name?.trim();
    // Keep meaningful or user-edited titles. Only replace the planner's placeholder.
    if (original && !isProvisionalWalkTitle(original)) return original;
    const subjects = knowledge.value?.subjects ?? [];
    const city = subjects.find((subject) => subject.kind === "city")?.name;
    const researched = new Set(
      (knowledge.value?.coverage ?? [])
        .filter((row) => row.status === "accepted" && row.claim_ids.length > 0)
        .map((row) => row.subject_id),
    );
    const places = [
      ...new Set(
        subjects
          .filter(
            (subject) =>
              researched.has(subject.id) &&
              !["city", "region", "country"].includes(subject.kind ?? ""),
          )
          .map((subject) => subject.name.trim())
          .filter(Boolean),
      ),
    ]
      .slice(0, 2)
      .join(" · ");
    if (city && places)
      return t("nativeWalk.cityPlacesTitle", { city, places });
    if (city) return t("nativeWalk.cityTitle", { city });
    if (places) return places;
    return t("nativeWalk.walkTitle");
  });
  return { knowledge, title };
}
