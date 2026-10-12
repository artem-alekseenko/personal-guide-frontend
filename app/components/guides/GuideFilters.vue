<script setup lang="ts">
import { useId } from "vue";
import type { GuideInteractionMode } from "#shared/types/guideInteraction";

const props = defineProps<{
  query: string;
  mode: GuideInteractionMode | "";
  topic: string;
  topics: readonly { value: string; label: string }[];
  active: boolean;
}>();
const emit = defineEmits<{
  "update:query": [value: string];
  "update:mode": [value: GuideInteractionMode | ""];
  "update:topic": [value: string];
  clear: [];
}>();
const searchId = useId();
const modes = ["", "interactive", "leading"] as const;

function updateQuery(event: Event) {
  emit("update:query", (event.target as HTMLInputElement).value);
}
</script>

<template>
  <div class="guide-filters">
    <div class="guide-filters__search-group">
      <label :for="searchId" class="guide-filters__label">{{
        $t("pages.guides.searchLabel")
      }}</label>
      <div class="guide-filters__search-wrap">
        <input
          :id="searchId"
          type="search"
          name="guide-search"
          autocomplete="off"
          :value="props.query"
          :placeholder="$t('pages.guides.searchPlaceholder')"
          class="guide-filters__search"
          @input="updateQuery"
        />
        <button
          v-if="props.query"
          type="button"
          class="guide-filters__clear-search"
          :aria-label="$t('pages.guides.clearSearch')"
          @click="emit('update:query', '')"
        >
          ×
        </button>
      </div>
    </div>
    <fieldset class="guide-filters__fieldset">
      <legend class="guide-filters__label">
        {{ $t("pages.guides.styleLabel") }}
      </legend>
      <div class="guide-filters__styles">
        <button
          v-for="mode in modes"
          :key="mode"
          type="button"
          class="guide-filters__choice"
          :aria-pressed="props.mode === mode"
          @click="emit('update:mode', mode)"
        >
          {{
            mode
              ? $t(`pages.guides.styles.${mode}`)
              : $t("pages.guides.allStyles")
          }}
        </button>
      </div>
    </fieldset>
    <fieldset v-if="props.topics.length" class="guide-filters__fieldset">
      <legend class="guide-filters__label">
        {{ $t("pages.guides.topicsLabel") }}
      </legend>
      <div class="guide-filters__topics">
        <button
          type="button"
          class="guide-filters__choice guide-filters__choice--topic"
          :aria-pressed="!props.topic"
          @click="emit('update:topic', '')"
        >
          {{ $t("pages.guides.allTopics") }}
        </button>
        <button
          v-for="topic in props.topics"
          :key="topic.value"
          type="button"
          class="guide-filters__choice guide-filters__choice--topic"
          :aria-pressed="props.topic === topic.value"
          @click="emit('update:topic', topic.value)"
        >
          {{ topic.label }}
        </button>
      </div>
    </fieldset>
    <button
      v-if="props.active"
      type="button"
      class="guide-filters__reset"
      @click="emit('clear')"
    >
      {{ $t("pages.guides.clearFilters") }}
    </button>
  </div>
</template>

<style scoped>
.guide-filters {
  display: grid;
  gap: 1.15rem;
}
.guide-filters__search-group {
  display: grid;
  gap: 0.5rem;
}
.guide-filters__label {
  display: block;
  margin-block-end: 0.5rem;
  font-size: 0.8125rem;
  font-weight: 650;
  color: var(--ui-text-highlighted);
}
.guide-filters__search-group .guide-filters__label {
  margin: 0;
}
.guide-filters__search-wrap {
  display: flex;
  align-items: center;
  border: 1px solid var(--ui-border);
  background: var(--ui-bg);
  border-radius: 0.875rem;
}
.guide-filters__search-wrap:focus-within {
  outline: 2px solid var(--ui-primary);
  outline-offset: 2px;
}
.guide-filters__search {
  min-inline-size: 0;
  inline-size: 100%;
  min-block-size: 3rem;
  padding: 0.75rem 0.875rem;
  color: var(--ui-text);
  background: transparent;
  border: 0;
  outline: none;
  font: inherit;
  font-size: 0.9375rem;
  border-radius: inherit;
}
.guide-filters__search::placeholder {
  color: var(--ui-text-muted);
}
.guide-filters__clear-search {
  flex-shrink: 0;
  min-inline-size: 2.75rem;
  min-block-size: 2.75rem;
  border: 0;
  border-radius: 0.75rem;
  background: transparent;
  color: var(--ui-text);
  font-size: 1.5rem;
  cursor: pointer;
}
.guide-filters__fieldset {
  min-inline-size: 0;
  padding: 0;
  margin: 0;
  border: 0;
}
.guide-filters__styles {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 0.375rem;
}
.guide-filters__topics {
  display: flex;
  gap: 0.375rem;
  overflow-x: auto;
  padding: 0.25rem 0.2rem 0.5rem;
  scrollbar-width: thin;
}
.guide-filters__choice {
  min-block-size: 2.75rem;
  max-inline-size: 100%;
  padding: 0.625rem 0.5rem;
  border: 1px solid var(--ui-border);
  border-radius: 0.75rem;
  background: var(--ui-bg);
  color: var(--ui-text);
  font: inherit;
  font-size: 0.8125rem;
  line-height: 1.4;
  overflow-wrap: anywhere;
  cursor: pointer;
  transition:
    background-color 150ms ease,
    border-color 150ms ease;
}
.guide-filters__choice[aria-pressed="true"] {
  border-color: var(--ui-primary);
  background: color-mix(in srgb, var(--ui-primary) 12%, var(--ui-bg));
  color: var(--ui-text-highlighted);
  font-weight: 650;
}
.guide-filters__choice--topic {
  flex: 0 0 auto;
  max-inline-size: min(15rem, 70vw);
  padding-inline: 0.875rem;
  border-radius: 999px;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}
.guide-filters__reset {
  justify-self: start;
  min-block-size: 2.75rem;
  padding: 0.5rem 0.25rem;
  border: 0;
  background: transparent;
  color: var(--ui-text);
  text-decoration: underline;
  text-underline-offset: 0.2em;
  font: inherit;
  font-size: 0.8125rem;
  cursor: pointer;
}
.guide-filters__choice:focus-visible,
.guide-filters__clear-search:focus-visible,
.guide-filters__reset:focus-visible {
  outline: 2px solid var(--ui-primary);
  outline-offset: 3px;
}
@media (prefers-reduced-motion: reduce) {
  .guide-filters__choice {
    transition: none;
  }
}
</style>
