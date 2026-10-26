<template>
  <details class="personal-context">
    <summary class="personal-context__summary">
      <span>
        <span class="personal-context__title">{{
          $t("experience.forThisWalk")
        }}</span>
        <span class="personal-context__hint">{{
          $t("pages.createRoute.preferencesHint")
        }}</span>
      </span>
      <svg
        class="personal-context__chevron"
        viewBox="0 0 20 20"
        fill="none"
        aria-hidden="true"
      >
        <path
          d="m5 7 5 5 5-5"
          stroke="currentColor"
          stroke-width="1.5"
          stroke-linecap="round"
          stroke-linejoin="round"
        />
      </svg>
    </summary>
    <div class="personal-context__fields">
      <label class="personal-context__check"
        ><input v-model="value.enabled" type="checkbox" />
        {{ $t("experience.personalize") }}</label
      >
      <label class="personal-context__check"
        ><input v-model="value.step_free" type="checkbox" />
        {{ $t("experience.stepFree") }}</label
      >
      <BaseSelector
        :model-value="interactionMode"
        :options="interactionOptions"
        :label="$t('experience.interactionStyle')"
        @update:model-value="updateInteractionPreference"
      />
      <template v-if="value.enabled">
        <label v-if="showInterests" class="grid gap-1"
          >{{ $t("experience.interests") }}
          <select
            v-model="value.interests"
            multiple
            class="rounded border p-2"
            @change="
              value.excluded_topics = value.excluded_topics.filter(
                (topic) => !value.interests.includes(topic),
              )
            "
          >
            <option v-for="topic in topics" :key="topic" :value="topic">
              {{ $t(`experience.topics.${topic}`) }}
            </option>
          </select>
        </label>
        <label class="grid gap-1"
          >{{ $t("experience.excludedTopics") }}
          <select
            v-model="value.excluded_topics"
            @change="
              value.interests = value.interests.filter(
                (topic) => !value.excluded_topics.includes(topic),
              )
            "
            multiple
            class="rounded border p-2"
          >
            <option v-for="topic in topics" :key="topic" :value="topic">
              {{ $t(`experience.topics.${topic}`) }}
            </option>
          </select>
        </label>
        <label class="grid gap-1"
          >{{ $t("experience.familiarity")
          }}<select v-model="value.knowledge_level" class="rounded border p-2">
            <option
              v-for="level in ['INTRODUCTORY', 'GENERAL', 'SPECIALIST']"
              :key="level"
              :value="level"
            >
              {{ $t(`experience.${level}`) }}
            </option>
          </select></label
        >
        <label class="grid gap-1"
          >{{ $t("experience.depth")
          }}<select v-model="value.detail_level" class="rounded border p-2">
            <option
              v-for="level in ['BRIEF', 'STANDARD', 'DEEP']"
              :key="level"
              :value="level"
            >
              {{ $t(`experience.${level}`) }}
            </option>
          </select></label
        >
        <label class="grid gap-1"
          >{{ $t("experience.pace")
          }}<select v-model="value.pace" class="rounded border p-2">
            <option
              v-for="pace in ['relaxed', 'normal', 'brisk']"
              :key="pace"
              :value="pace"
            >
              {{ $t(`experience.${pace}`) }}
            </option>
          </select></label
        >
      </template>
    </div>
  </details>
</template>
<script setup lang="ts">
import type { PersonalContext } from "~/types/personalContext";
import {
  normalizeGuideInteractionMode,
  normalizeInteractionPreference,
  type GuideInteractionMode,
} from "#shared/types/guideInteraction";
const props = withDefaults(
  defineProps<{ showInterests?: boolean; guideMode?: GuideInteractionMode }>(),
  {
    showInterests: true,
  },
);
const value = defineModel<PersonalContext>({ required: true });
const { t } = useI18n();
const interactionMode = computed(() => {
  const mode = normalizeInteractionPreference(value.value.interaction_mode);
  return mode === "guide"
    ? normalizeGuideInteractionMode(props.guideMode)
    : mode;
});
const interactionOptions = computed(() =>
  (["leading", "interactive"] as const).map((mode) => ({
    value: mode,
    label: t(`experience.interactionModes.${mode}`),
  })),
);
function updateInteractionPreference(mode: string) {
  value.value = {
    ...value.value,
    interaction_mode: normalizeInteractionPreference(mode),
  };
}
const topics = [
  "nature",
  "movies",
  "it",
  "politics",
  "science",
  "art",
  "museum",
  "for_child",
];
</script>

<style scoped>
.personal-context {
  min-inline-size: 0;
  border: 1px solid var(--ui-border);
  border-radius: 1.125rem;
  background: var(--ui-bg);
  color: var(--ui-text);
}
.personal-context__summary {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 0.75rem;
  min-block-size: 3.5rem;
  padding: 1rem;
  border-radius: inherit;
  list-style: none;
  cursor: pointer;
}
.personal-context__summary::-webkit-details-marker {
  display: none;
}
.personal-context__summary:focus-visible {
  outline: 2px solid var(--ui-primary);
  outline-offset: 2px;
}
.personal-context__title {
  display: block;
  font-size: 0.875rem;
  font-weight: 650;
  color: var(--ui-text-highlighted);
}
.personal-context__hint {
  display: block;
  margin-block-start: 0.25rem;
  font-size: 0.75rem;
  line-height: 1.5;
  color: var(--ui-text-muted);
}
.personal-context__chevron {
  flex: 0 0 1.25rem;
  inline-size: 1.25rem;
  block-size: 1.25rem;
  transition: transform 150ms ease;
}
.personal-context[open] .personal-context__chevron {
  transform: rotate(180deg);
}
.personal-context__fields {
  display: grid;
  gap: 1rem;
  padding: 0.25rem 1rem 1rem;
  font-size: 0.8125rem;
}
.personal-context__check {
  display: flex;
  align-items: center;
  gap: 0.75rem;
  min-block-size: 2.75rem;
  padding: 0.625rem 0.75rem;
  border-radius: 0.75rem;
  background: var(--ui-bg-muted);
  cursor: pointer;
}
.personal-context__check input {
  flex-shrink: 0;
  inline-size: 1.125rem;
  block-size: 1.125rem;
  accent-color: var(--ui-primary);
}
.personal-context__fields :deep(select) {
  min-inline-size: 0;
  inline-size: 100%;
  min-block-size: 2.75rem;
  border: 1px solid var(--ui-border-accented);
  border-radius: 0.75rem;
  background: var(--ui-bg);
  color: var(--ui-text);
  padding: 0.625rem 0.75rem;
  font-size: 0.875rem;
}
.personal-context__fields :deep(.base-selector__label) {
  color: var(--ui-text);
  font-size: 0.8125rem;
}
.personal-context__fields :deep(select:focus-visible),
.personal-context__check input:focus-visible {
  outline: 2px solid var(--ui-primary);
  outline-offset: 2px;
}
@media (prefers-reduced-motion: reduce) {
  .personal-context__chevron {
    transition: none;
  }
}
</style>
