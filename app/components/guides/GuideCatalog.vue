<script setup lang="ts">
import { computed, shallowRef, useId } from "vue";
import type { IGuide } from "~/types";
import { normalizeGuideInteractionMode } from "#shared/types/guideInteraction";
import type { GuideInteractionMode } from "#shared/types/guideInteraction";
import PGGuide from "~/components/PGGuide.vue";
import PGButton from "~/components/ui/PGButton.vue";
import GuideFilters from "./GuideFilters.vue";

const props = defineProps<{
  guides: readonly IGuide[];
  loading: boolean;
  error: string | null;
  selectedGuideId?: string | null;
}>();
const emit = defineEmits<{ retry: [] }>();
const browseTitleId = useId();
const query = shallowRef("");
const mode = shallowRef<GuideInteractionMode | "">("");
const topic = shallowRef("");
const activeFilters = computed(() =>
  Boolean(query.value || mode.value || topic.value),
);
const topics = computed(() => {
  const labels = new Map<string, string>();
  for (const guide of props.guides) {
    for (const tag of guide.tags) {
      const label = tag.name.trim();
      const value = label.toLowerCase();
      if (value && !labels.has(value)) labels.set(value, label);
    }
  }
  return Array.from(labels, ([value, label]) => ({ value, label }));
});
const visibleGuides = computed(() => {
  const search = query.value.trim().toLowerCase();
  return props.guides.filter((guide) => {
    if (
      mode.value &&
      normalizeGuideInteractionMode(guide.interaction_mode) !== mode.value
    )
      return false;
    if (
      topic.value &&
      !guide.tags.some((tag) => tag.name.trim().toLowerCase() === topic.value)
    )
      return false;
    return (
      !search ||
      guide.name.toLowerCase().includes(search) ||
      guide.context.toLowerCase().includes(search) ||
      guide.skills.toLowerCase().includes(search) ||
      guide.tags.some((tag) => tag.name.toLowerCase().includes(search))
    );
  });
});
function clearFilters() {
  query.value = "";
  mode.value = "";
  topic.value = "";
}
</script>

<template>
  <div class="guide-catalog">
    <header class="guide-catalog__hero">
      <div class="guide-catalog__illustration" aria-hidden="true">
        <svg viewBox="0 0 180 130" fill="none" class="guide-catalog__journal">
          <rect
            x="30"
            y="18"
            width="112"
            height="98"
            rx="16"
            class="guide-catalog__paper"
          />
          <path
            d="M54 95C37 66 102 88 81 56C64 30 133 44 117 26"
            class="guide-catalog__trail"
            stroke-width="3"
            stroke-linecap="round"
            stroke-dasharray="4 7"
          />
          <circle cx="54" cy="95" r="6" class="guide-catalog__dot" />
          <circle cx="117" cy="26" r="6" class="guide-catalog__dot" />
          <path d="M126 77L135 68L144 77L135 86Z" class="guide-catalog__star" />
        </svg>
      </div>
      <p class="guide-catalog__eyebrow">{{ $t("pages.guides.heroEyebrow") }}</p>
      <h1 class="guide-catalog__title">{{ $t("pages.guides.heroTitle") }}</h1>
      <p class="guide-catalog__description">
        {{ $t("pages.guides.heroDescription") }}
      </p>
      <ol class="guide-catalog__steps">
        <li
          class="guide-catalog__step guide-catalog__step--current"
          aria-current="step"
        >
          <span class="guide-catalog__step-number" aria-hidden="true">1</span
          >{{ $t("pages.guides.steps.guide") }}
        </li>
        <li class="guide-catalog__step">
          <span class="guide-catalog__step-number" aria-hidden="true">2</span
          >{{ $t("pages.guides.steps.route") }}
        </li>
        <li class="guide-catalog__step">
          <span class="guide-catalog__step-number" aria-hidden="true">3</span
          >{{ $t("pages.guides.steps.walk") }}
        </li>
      </ol>
    </header>

    <section
      class="guide-catalog__browse"
      :aria-busy="props.loading"
      :aria-labelledby="browseTitleId"
    >
      <h2 :id="browseTitleId" class="guide-catalog__browse-title">
        {{ $t("pages.guides.browseTitle") }}
      </h2>
      <div v-if="props.loading" class="guide-catalog__state" role="status">
        <div class="guide-catalog__loading-mark" aria-hidden="true">
          <span /><span /><span />
        </div>
        <p>{{ $t("pages.guides.loadingGuides") }}</p>
      </div>
      <div v-else-if="props.error" class="guide-catalog__state" role="alert">
        <h3 class="guide-catalog__state-title">
          {{ $t("pages.guides.errorTitle") }}
        </h3>
        <p>{{ $t("common.loadFailed") }}</p>
        <PGButton @click="emit('retry')">{{ $t("buttons.tryAgain") }}</PGButton>
        <NuxtLink to="/tours" class="guide-catalog__back">{{
          $t("navigation.backToTours")
        }}</NuxtLink>
      </div>
      <div
        v-else-if="!props.guides.length"
        class="guide-catalog__state"
        role="status"
      >
        <h3 class="guide-catalog__state-title">
          {{ $t("pages.guides.emptyTitle") }}
        </h3>
        <p>{{ $t("pages.guides.empty") }}</p>
        <PGButton @click="emit('retry')">{{ $t("buttons.tryAgain") }}</PGButton>
        <NuxtLink to="/tours" class="guide-catalog__back">{{
          $t("navigation.backToTours")
        }}</NuxtLink>
      </div>
      <template v-else>
        <GuideFilters
          v-model:query="query"
          v-model:mode="mode"
          v-model:topic="topic"
          :topics="topics"
          :active="activeFilters"
          @clear="clearFilters"
        />
        <p
          class="guide-catalog__results"
          role="status"
          aria-live="polite"
          aria-atomic="true"
        >
          {{
            $t("pages.guides.results", {
              count: visibleGuides.length,
              total: props.guides.length,
            })
          }}
        </p>
        <div v-if="!visibleGuides.length" class="guide-catalog__state">
          <h3 class="guide-catalog__state-title">
            {{ $t("pages.guides.noResultsTitle") }}
          </h3>
          <p>{{ $t("pages.guides.noResultsDescription") }}</p>
          <PGButton variant="outline" @click="clearFilters">{{
            $t("pages.guides.clearFilters")
          }}</PGButton>
        </div>
        <ul v-else class="guide-catalog__list">
          <li
            v-for="guide in visibleGuides"
            :key="guide.id"
            class="guide-catalog__item"
          >
            <PGGuide
              :guide="guide"
              :selected="guide.id === props.selectedGuideId"
            />
          </li>
        </ul>
      </template>
    </section>
  </div>
</template>

<style scoped>
.guide-catalog {
  display: grid;
  gap: 1.25rem;
  inline-size: 100%;
  box-sizing: border-box;
  min-inline-size: 0;
  padding: 1rem;
  color: var(--ui-text);
}
.guide-catalog__hero {
  position: relative;
  isolation: isolate;
  overflow: hidden;
  padding: 1.125rem 1rem 1rem;
  border: 1px solid var(--ui-border);
  border-radius: 1.5rem;
  background: color-mix(in srgb, var(--ui-secondary) 6%, var(--ui-bg-elevated));
}
.guide-catalog__illustration {
  position: absolute;
  z-index: -1;
  inset-block-start: -0.5rem;
  inset-inline-end: -2rem;
  inline-size: 11rem;
  transform: rotate(12deg);
  opacity: 0.45;
  pointer-events: none;
}
.guide-catalog__journal {
  inline-size: 100%;
}
.guide-catalog__paper {
  fill: var(--ui-bg);
  stroke: var(--ui-border);
}
.guide-catalog__trail {
  stroke: var(--ui-primary);
}
.guide-catalog__dot {
  fill: var(--ui-primary);
}
.guide-catalog__star {
  fill: var(--ui-secondary);
}
.guide-catalog__eyebrow {
  position: relative;
  margin: 0 0 0.5rem;
  max-inline-size: 75%;
  color: var(--ui-text-muted);
  font-size: 0.6875rem;
  font-weight: 700;
  letter-spacing: 0.1em;
  text-transform: uppercase;
  overflow-wrap: anywhere;
}
.guide-catalog__title {
  position: relative;
  max-inline-size: 20ch;
  margin: 0;
  color: var(--ui-text-highlighted);
  font-size: clamp(1.75rem, 7vw, 2.25rem);
  font-weight: 650;
  line-height: 1.15;
  letter-spacing: -0.035em;
  overflow-wrap: anywhere;
  text-wrap: balance;
}
.guide-catalog__description {
  margin: 0.625rem 0 1rem;
  font-size: 0.875rem;
  line-height: 1.5;
}
.guide-catalog__steps {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 0.5rem;
  padding: 0.75rem 0 0;
  margin: 0;
  list-style: none;
  border-block-start: 1px solid var(--ui-border);
}
.guide-catalog__step {
  display: flex;
  align-items: center;
  gap: 0.375rem;
  min-inline-size: 0;
  color: var(--ui-text-muted);
  font-size: 0.75rem;
  line-height: 1.4;
  overflow-wrap: anywhere;
}
.guide-catalog__step--current {
  color: var(--ui-text-highlighted);
  font-weight: 650;
}
.guide-catalog__step-number {
  display: grid;
  place-items: center;
  flex-shrink: 0;
  inline-size: 1.5rem;
  block-size: 1.5rem;
  border: 1px solid var(--ui-border);
  border-radius: 50%;
}
.guide-catalog__step--current .guide-catalog__step-number {
  background: color-mix(in srgb, var(--ui-primary) 16%, var(--ui-bg));
  border-color: var(--ui-primary);
}
.guide-catalog__browse {
  min-inline-size: 0;
}
.guide-catalog__browse-title {
  margin: 0 0 0.75rem;
  color: var(--ui-text-highlighted);
  font-size: 1.25rem;
  font-weight: 650;
  letter-spacing: -0.02em;
}
.guide-catalog__results {
  margin: 1rem 0 0.875rem;
  font-size: 0.8125rem;
  color: var(--ui-text-muted);
}
.guide-catalog__list {
  display: grid;
  gap: 1rem;
  padding: 0;
  margin: 0;
  list-style: none;
}
.guide-catalog__item {
  min-inline-size: 0;
}
.guide-catalog__state {
  display: grid;
  justify-items: center;
  gap: 0.875rem;
  padding: 2rem 1.25rem;
  border: 1px dashed var(--ui-border);
  border-radius: 1.25rem;
  background: var(--ui-bg-elevated);
  text-align: center;
  line-height: 1.6;
}
.guide-catalog__state p {
  margin: 0;
}
.guide-catalog__state-title {
  margin: 0;
  color: var(--ui-text-highlighted);
  font-size: 1.125rem;
  font-weight: 650;
}
.guide-catalog__back {
  display: inline-flex;
  align-items: center;
  min-block-size: 2.75rem;
  color: var(--ui-text);
  text-decoration: underline;
  text-underline-offset: 0.2em;
}
.guide-catalog__back:focus-visible {
  outline: 2px solid var(--ui-primary);
  outline-offset: 3px;
}
.guide-catalog__loading-mark {
  display: flex;
  gap: 0.375rem;
}
.guide-catalog__loading-mark span {
  inline-size: 0.5rem;
  block-size: 0.5rem;
  border-radius: 50%;
  background: var(--ui-primary);
}
.guide-catalog__loading-mark span:nth-child(2) {
  opacity: 0.6;
}
.guide-catalog__loading-mark span:nth-child(3) {
  opacity: 0.3;
}
@media (min-width: 480px) {
  .guide-catalog {
    padding: 1.25rem;
  }
  .guide-catalog__hero {
    padding: 1.75rem 1.5rem 1.25rem;
  }
}
</style>
