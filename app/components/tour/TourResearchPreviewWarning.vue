<script setup lang="ts">
import { computed } from "vue";
import type { IRoutePoint, ResearchPreview } from "~/types";

const props = defineProps<{
  preview: ResearchPreview;
  stops?: IRoutePoint[];
}>();
const missingNames = computed(() =>
  props.preview.missing_stop_ids
    .map((id) => props.stops?.find((stop) => stop.id === id)?.name || id)
    .join(", "),
);
</script>

<template>
  <aside
    class="border-warning bg-elevated text-default my-3 grid gap-2 rounded-lg border p-3 text-sm"
    role="note"
  >
    <strong class="text-warning">{{ $t("researchPreview.title") }}</strong>
    <p>{{ $t("researchPreview.warning") }}</p>
    <p>{{ $t("researchPreview.originalPreserved") }}</p>
    <p>
      {{
        $t("researchPreview.coverage", {
          available: preview.available_stop_ids.length,
          missing: preview.missing_stop_ids.length,
        })
      }}
    </p>
    <p v-if="preview.missing_stop_ids.length">
      {{ $t("researchPreview.missingStops", { names: missingNames }) }}
    </p>
    <p v-if="!preview.available_stop_ids.length">
      {{ $t("researchPreview.routeOnly") }}
    </p>
  </aside>
</template>
