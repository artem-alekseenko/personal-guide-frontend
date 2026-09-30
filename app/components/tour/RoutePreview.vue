<template>
  <aside
    class="grid gap-2 rounded border p-3"
    :aria-label="$t('experience.routePreview')"
  >
    <h2 class="font-semibold">{{ route.name }}</h2>
    <p v-if="route.total_minutes !== undefined">
      {{ $t("experience.routeTotal", { minutes: route.total_minutes }) }}
    </p>
    <ol class="list-inside list-decimal">
      <li v-for="(stop, index) in route.stops" :key="index">{{ stop.name }}</li>
    </ol>
    <p>
      {{ $t("experience.pace") }}:
      {{ $t(`experience.${context.enabled ? context.pace : "normal"}`) }}
    </p>
    <p v-if="context.enabled && context.interests.length">
      {{ $t("experience.interests") }}:
      {{ context.interests.map(topicLabel).join(", ") }}
    </p>
    <p v-if="context.enabled && context.excluded_topics.length">
      {{ $t("experience.excludedTopics") }}:
      {{ context.excluded_topics.map(topicLabel).join(", ") }}
    </p>
    <p class="text-sm">{{ $t("experience.routeAccessUnknown") }}</p>
  </aside>
</template>
<script setup lang="ts">
import type { IRoute } from "~/types";
import type { PersonalContext } from "~/types/personalContext";
defineProps<{ route: IRoute; context: PersonalContext }>();
const { t, te } = useI18n();
const topicLabel = (topic: string) =>
  te(`experience.topics.${topic}`) ? t(`experience.topics.${topic}`) : topic;
</script>
