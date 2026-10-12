<script setup lang="ts">
import type { DiscoveredPlace, RouteDiscovery } from "~/types/routeDiscovery";
defineProps<{
  places: readonly DiscoveredPlace[];
  discovery?: RouteDiscovery | null;
  busy?: boolean;
  failed?: boolean;
  pending?: boolean;
  canAsk?: boolean;
}>();
const emit = defineEmits<{
  ask: [place: DiscoveredPlace];
  retry: [];
  reconcile: [];
}>();
</script>

<template>
  <aside
    class="grid gap-2 rounded border p-3"
    :aria-label="$t('routePlaces.title')"
  >
    <h3 class="font-medium">{{ $t("routePlaces.title") }}</h3>
    <p class="text-sm">{{ $t("routePlaces.source") }}</p>
    <p class="text-sm">{{ $t("routePlaces.caveat") }}</p>
    <p v-if="discovery" class="text-sm" role="status">
      {{ $t(`routePlaces.status.${discovery.status}`) }}
    </p>
    <p v-if="busy" class="text-sm" role="status">
      {{ $t("routePlaces.loading") }}
    </p>
    <p v-if="failed" class="text-sm" role="alert">
      {{ $t("routePlaces.failed") }}
    </p>
    <div v-if="failed" class="flex flex-wrap gap-2">
      <button
        v-if="pending"
        class="rounded border px-3 py-2"
        :disabled="busy"
        @click="emit('retry')"
      >
        {{ $t("experience.retry") }}
      </button>
      <button
        class="rounded border px-3 py-2"
        :disabled="busy"
        @click="emit('reconcile')"
      >
        {{ $t("experience.refresh") }}
      </button>
    </div>
    <p
      v-for="warning in discovery?.warnings ?? []"
      :key="warning"
      class="text-sm"
    >
      {{ warning }}
    </p>
    <ul
      v-if="places.length"
      class="grid max-h-64 gap-2 overflow-auto"
      :aria-label="$t('routePlaces.list')"
    >
      <li v-for="place in places" :key="place.id" class="rounded border p-2">
        <p class="font-medium">{{ place.name }}</p>
        <p v-if="place.address" class="text-sm">{{ place.address }}</p>
        <p v-if="place.research_status" class="text-sm">
          {{ $t(`routePlaces.research.${place.research_status}`) }}
        </p>
        <button
          class="mt-1 rounded border px-3 py-2 text-sm"
          :disabled="!canAsk"
          @click="emit('ask', place)"
        >
          {{ $t("routePlaces.ask") }}
        </button>
      </li>
    </ul>
    <p v-else-if="!busy" class="text-sm">{{ $t("routePlaces.empty") }}</p>
  </aside>
</template>
