<script setup lang="ts">
import { computed } from "vue";
import type { ICreatedTour } from "~/types";
import { useNativeWalkPresentation } from "~/composables/tour/useNativeWalkPresentation";
import NativeWalkPreparation from "./NativeWalkPreparation.vue";
import TourCover from "./TourCover.vue";
const emit = defineEmits<{ updated: [] }>();
const props = defineProps<{ tour: ICreatedTour }>();
const { title } = useNativeWalkPresentation(computed(() => props.tour));
const minutes = computed(() =>
  Math.round((props.tour.route.walking_plan?.duration_seconds ?? 0) / 60),
);
</script>
<template>
  <article class="native-tour-card pg-surface">
    <TourCover :src="tour.image" />
    <div class="grid gap-3 p-5">
      <h2 class="text-lg font-semibold">
        {{ title }}
      </h2>
      <details
        v-if="tour.description"
        class="text-muted text-sm leading-relaxed"
      >
        <summary class="min-h-11 cursor-pointer py-3">
          {{ $t("nativeWalk.aboutWalk") }}
        </summary>
        <p>{{ tour.description }}</p>
      </details>
      <p class="text-muted text-sm">
        {{
          $t("nativeWalk.estimate", {
            minutes,
            meters: Math.round(tour.route.walking_plan?.distance_meters ?? 0),
          })
        }}
      </p>
      <NuxtLink
        :to="`/tours/${encodeURIComponent(tour.id)}`"
        class="native-walk-open inline-flex min-h-11 items-center justify-center rounded-lg px-4 py-3 font-semibold"
        >{{
          $t(
            tour.status === "GENERATING"
              ? "nativeWalk.viewPreparation"
              : "nativeWalk.openWalk",
          )
        }}</NuxtLink
      >
      <NativeWalkPreparation :tour="tour" compact @updated="emit('updated')" />
    </div>
  </article>
</template>

<style scoped>
.native-tour-card {
  padding: 0;
  overflow: hidden;
}
.native-walk-open {
  background-color: var(--fill-green-700);
  color: oklch(1 0 0);
}
.native-walk-open:hover {
  background-color: var(--fill-green-800);
}
.native-walk-open:focus-visible {
  outline: 2px solid var(--fill-green-700);
  outline-offset: 3px;
}
</style>
