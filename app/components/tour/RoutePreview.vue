<template>
  <aside class="route-preview" :aria-label="$t('experience.routePreview')">
    <h2 class="route-preview__title">{{ route.name }}</h2>
    <p v-if="route.total_minutes !== undefined" class="route-preview__duration">
      {{ $t("experience.routeTotal", { minutes: route.total_minutes }) }}
    </p>
    <ol class="route-preview__stops">
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
    <p class="route-preview__access">
      {{ $t("experience.routeAccessUnknown") }}
    </p>
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

<style scoped>
.route-preview {
  display: grid;
  gap: 0.875rem;
  min-inline-size: 0;
  padding: 1.25rem;
  border: 1px solid color-mix(in srgb, var(--ui-primary) 25%, var(--ui-border));
  border-radius: 1.25rem;
  background: var(--ui-bg);
  color: var(--ui-text);
  font-size: 0.8125rem;
  line-height: 1.6;
  overflow-wrap: anywhere;
}
.route-preview__title {
  margin: 0;
  font-family: Georgia, serif;
  font-size: 1.375rem;
  line-height: 1.3;
  color: var(--ui-text-highlighted);
}
.route-preview__duration {
  justify-self: start;
  margin: 0;
  padding: 0.25rem 0.625rem;
  border-radius: 999px;
  background: color-mix(in srgb, var(--ui-primary) 8%, var(--ui-bg));
  font-weight: 600;
}
.route-preview__stops {
  counter-reset: stops;
  display: grid;
  gap: 0;
  margin: 0.25rem 0;
  padding: 0;
  list-style: none;
}
.route-preview__stops li {
  position: relative;
  display: flex;
  align-items: baseline;
  gap: 0.75rem;
  padding-block: 0.5rem;
}
.route-preview__stops li::before {
  counter-increment: stops;
  content: counter(stops);
  display: grid;
  place-items: center;
  flex: 0 0 1.5rem;
  block-size: 1.5rem;
  border-radius: 50%;
  background: color-mix(in srgb, var(--ui-primary) 10%, var(--ui-bg));
  color: var(--ui-text-highlighted);
  font-size: 0.6875rem;
  font-weight: 700;
}
.route-preview__access {
  margin: 0;
  padding-block-start: 0.75rem;
  border-block-start: 1px solid var(--ui-border);
  color: var(--ui-text-muted);
  font-size: 0.75rem;
}
</style>
