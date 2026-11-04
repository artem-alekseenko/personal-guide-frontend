<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, shallowRef, watch } from "vue";
import { useRoute } from "vue-router";
import { useTourStore } from "~/stores/tourStore";
import { useUserStore } from "~/stores/userStore";
import { useGetTour } from "~/composables/api/tours/useGetTour";
import NativeTourWalk from "~/components/tour/NativeTourWalk.vue";
import LegacyTourWalk from "~/components/tour/LegacyTourWalk.vue";
definePageMeta({ key: (route) => route.fullPath });
const route = useRoute();
const store = useTourStore();
const users = useUserStore();
const owner = users.user?.uid;
const id = String(route.params.tourId);
const loading = shallowRef(true);
const failed = shallowRef(false);
let alive = true;
let revision = 0;
const tour = computed(() =>
  users.user?.uid === owner && store.tour?.id === id ? store.tour : null,
);
async function load() {
  const attempt = ++revision;
  loading.value = !tour.value;
  failed.value = false;
  try {
    const result = await useGetTour(id);
    if (alive && attempt === revision && users.user?.uid === owner)
      store.setTour(result);
  } catch {
    if (alive && attempt === revision) failed.value = true;
  } finally {
    if (alive && attempt === revision) loading.value = false;
  }
}
onMounted(load);
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
    @updated="load"
  />
  <LegacyTourWalk v-else-if="tour" />
</template>
