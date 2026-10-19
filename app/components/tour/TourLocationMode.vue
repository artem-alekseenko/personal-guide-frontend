<script setup lang="ts">
import { useId } from "vue";

const manual = defineModel<boolean>({ required: true });
defineProps<{ gpsAvailable: boolean }>();
const name = useId();
</script>

<template>
  <fieldset class="grid min-w-0 gap-2 p-3">
    <legend class="sr-only">{{ $t("components.map.positionMode") }}</legend>
    <div class="flex flex-wrap gap-2">
      <label
        class="border-default bg-default text-default has-checked:border-primary has-checked:bg-primary/10 flex min-h-11 flex-1 cursor-pointer items-center gap-2 rounded-lg border px-3 py-2 text-sm"
      >
        <input
          v-model="manual"
          type="radio"
          :name="name"
          :value="false"
          class="accent-primary focus-visible:outline-primary size-4 shrink-0 focus-visible:outline-2 focus-visible:outline-offset-2"
        />
        {{ $t("components.tourPage.realGeolocation") }}
      </label>
      <label
        class="border-default bg-default text-default has-checked:border-primary has-checked:bg-primary/10 flex min-h-11 flex-1 cursor-pointer items-center gap-2 rounded-lg border px-3 py-2 text-sm"
      >
        <input
          v-model="manual"
          type="radio"
          :name="name"
          :value="true"
          class="accent-primary focus-visible:outline-primary size-4 shrink-0 focus-visible:outline-2 focus-visible:outline-offset-2"
        />
        {{ $t("components.tourPage.geolocationSimulation") }}
      </label>
    </div>
    <p class="text-muted text-xs" role="status">
      {{
        $t(
          manual
            ? "components.tourPage.clickToSimulate"
            : gpsAvailable
              ? "components.tourPage.usingRealLocation"
              : "components.map.gpsUnavailable",
        )
      }}
    </p>
  </fieldset>
</template>
