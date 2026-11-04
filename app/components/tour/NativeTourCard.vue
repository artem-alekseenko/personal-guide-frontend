<script setup lang="ts">
import { computed } from "vue";
import type { ICreatedTour } from "~/types";
import NativeWalkPreparation from "./NativeWalkPreparation.vue";
const emit = defineEmits<{ updated: [] }>();
const props = defineProps<{ tour: ICreatedTour }>();
const minutes = computed(() =>
  Math.round((props.tour.route.walking_plan?.duration_seconds ?? 0) / 60),
);
</script>
<template>
  <article class="border-default bg-default grid gap-3 rounded-xl border p-4">
    <h2 class="text-lg font-semibold">
      {{ tour.name || $t("nativeWalk.walkTitle") }}
    </h2>
    <p v-if="tour.description">{{ tour.description }}</p>
    <p>
      {{
        $t("nativeWalk.estimate", {
          minutes,
          meters: Math.round(tour.route.walking_plan?.distance_meters ?? 0),
        })
      }}
    </p>
    <NativeWalkPreparation :tour="tour" compact @updated="emit('updated')" />
    <NuxtLink
      :to="`/tours/${encodeURIComponent(tour.id)}`"
      class="inline-flex min-h-11 items-center underline"
      >{{
        $t(
          tour.status === "GENERATING"
            ? "nativeWalk.viewPreparation"
            : "nativeWalk.openWalk",
        )
      }}</NuxtLink
    >
  </article>
</template>
