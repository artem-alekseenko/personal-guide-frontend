<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, shallowRef, watch } from "vue";
import { useRoute } from "vue-router";
import { useTourStore } from "~/stores/tourStore";
import { useUserStore } from "~/stores/userStore";
import { useGetTour } from "~/composables/api/tours/useGetTour";
import { isProvisionalWalkTitle } from "~/composables/tour/useNativeWalkPresentation";
import NativeTourWalk from "~/components/tour/NativeTourWalk.vue";
import LegacyTourWalk from "~/components/tour/LegacyTourWalk.vue";
definePageMeta({
  alias: ["/tours/:tourId/walk"],
  key: (route) => String(route.params.tourId),
  backToTours: true,
});
const route = useRoute();
const store = useTourStore();
const users = useUserStore();
const owner = users.user?.uid;
const id = String(route.params.tourId);
const walking = computed(() => /^\/tours\/[^/]+\/walk\/?$/.test(route.path));
const loading = shallowRef(true);
const failed = shallowRef(false);
let alive = true;
let revision = 0;
let pendingLoad: Promise<void> | undefined;
const tour = computed(() =>
  users.user?.uid === owner && store.tour?.id === id ? store.tour : null,
);
async function refreshTour() {
  const attempt = ++revision;
  loading.value = !tour.value;
  failed.value = false;
  try {
    const result = await useGetTour(id);
    if (alive && attempt === revision && users.user?.uid === owner)
      store.setTour(result);
  } catch {
    if (alive && attempt === revision) failed.value = !tour.value;
  } finally {
    if (alive && attempt === revision) loading.value = false;
  }
}
function load() {
  pendingLoad ??= refreshTour().finally(() => {
    pendingLoad = undefined;
  });
  return pendingLoad;
}
onMounted(load);
watch(
  () =>
    !walking.value &&
    !!tour.value?.route.walking_plan &&
    !!tour.value.playback_generation_id &&
    (isProvisionalWalkTitle(tour.value.name) ||
      !tour.value.description?.trim() ||
      !tour.value.image?.trim()),
  (waitingForPresentation, _, onCleanup) => {
    if (!waitingForPresentation) return;
    const fastUntil = Date.now() + 30_000;
    let active = true;
    let timer: ReturnType<typeof setTimeout> | undefined;
    async function refresh() {
      await load();
      schedule();
    }
    function schedule() {
      clearTimeout(timer);
      if (active && document.visibilityState === "visible" && alive) {
        timer = setTimeout(refresh, Date.now() < fastUntil ? 2000 : 10_000);
      }
    }
    function onVisibilityChange() {
      clearTimeout(timer);
      if (document.visibilityState === "visible") void refresh();
    }
    document.addEventListener("visibilitychange", onVisibilityChange);
    schedule();
    onCleanup(() => {
      active = false;
      clearTimeout(timer);
      document.removeEventListener("visibilitychange", onVisibilityChange);
    });
  },
);
function openWalk() {
  if (!walking.value)
    return navigateTo(
      { path: `/tours/${encodeURIComponent(id)}/walk`, force: true },
      { replace: true },
    );
}
watch(
  () => users.user?.uid,
  () => {
    if (users.user?.uid !== owner) revision++;
  },
);
onBeforeUnmount(() => {
  alive = false;
  revision++;
});
</script>
<template>
  <p v-if="loading" class="p-6 text-center" role="status">
    {{ $t("common.loading") }}
  </p>
  <div v-else-if="failed" class="grid gap-3 p-6" role="alert">
    <p>{{ $t("common.loadFailed") }}</p>
    <PGButton @click="load">{{ $t("buttons.tryAgain") }}</PGButton>
  </div>
  <NativeTourWalk
    v-else-if="tour?.route.walking_plan"
    :key="`${tour.id}:${tour.playback_generation_id}`"
    :tour="tour"
    :walking="walking"
    @updated="load"
    @open="openWalk"
    @finished="navigateTo('/tours', { replace: true })"
  />
  <LegacyTourWalk v-else-if="tour" />
</template>
