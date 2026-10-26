<script lang="ts" setup>
import { computed, reactive, shallowRef, watch } from "vue";
import type { IGuide } from "~/types";
import { normalizeGuideInteractionMode } from "#shared/types/guideInteraction";
import { useGuidesStore } from "~/stores/guidesStore";
import PGButton from "~/components/ui/PGButton.vue";

interface Props {
  guide: IGuide;
  selected?: boolean;
}

const props = defineProps<Props>();
const router = useRouter();
const guidesStore = useGuidesStore();
const avatarFailed = shallowRef(false);
const detailsOpen = shallowRef(false);
const failedTourImages = reactive(new Set<string>());
const mode = computed(() =>
  normalizeGuideInteractionMode(props.guide.interaction_mode),
);
const initial = computed(() => props.guide.name.trim().charAt(0).toUpperCase());
const tags = computed(() => {
  const labels = new Map<string, string>();
  for (const tag of props.guide.tags) {
    const label = tag.name.trim();
    const value = label.toLowerCase();
    if (value && !labels.has(value)) labels.set(value, label);
  }
  return [...labels.values()];
});

watch(
  () => [props.guide.id, props.guide.avatar],
  () => {
    avatarFailed.value = false;
  },
);
watch(
  () => props.guide.id,
  () => {
    detailsOpen.value = false;
    failedTourImages.clear();
  },
);

function toggleDetails(event: Event) {
  detailsOpen.value = (event.currentTarget as HTMLDetailsElement).open;
}

function selectGuide() {
  useRouteStore().reset();
  guidesStore.setSelectedGuide(props.guide);
  router.push("/create-route");
}
</script>

<template>
  <article class="pg-guide" :class="{ 'pg-guide--selected': selected }">
    <header class="pg-guide__identity">
      <div class="pg-guide__portrait">
        <img
          v-if="guide.avatar && !avatarFailed"
          :key="guide.avatar"
          :alt="guide.name"
          :src="guide.avatar"
          class="pg-guide__avatar"
          width="80"
          height="80"
          loading="lazy"
          decoding="async"
          @error="avatarFailed = true"
        />
        <span v-else class="pg-guide__initial" aria-hidden="true">{{
          initial
        }}</span>
      </div>
      <div class="pg-guide__heading">
        <span v-if="selected" class="pg-guide__selected">
          {{ $t("components.guide.selected") }}
        </span>
        <h3 class="pg-guide__name">{{ guide.name }}</h3>
        <span class="pg-guide__mode">
          {{ $t(`experience.interactionModes.${mode}`) }}
        </span>
      </div>
    </header>

    <p class="pg-guide__context pg-guide__preview">
      {{ guide.context.trim() || $t("components.guide.noContext") }}
    </p>
    <p v-if="guide.skills.trim()" class="pg-guide__skills pg-guide__preview">
      <span class="pg-guide__skills-label">{{
        $t("components.guide.skills")
      }}</span>
      {{ guide.skills }}
    </p>
    <ul v-if="tags.length" class="pg-guide__tags">
      <li v-for="tag in tags" :key="tag" class="pg-guide__tag">{{ tag }}</li>
    </ul>

    <details
      :key="guide.id"
      class="pg-guide__details"
      :open="detailsOpen"
      @toggle="toggleDetails"
    >
      <summary
        class="pg-guide__summary"
        :aria-label="$t('components.guide.detailsFor', { name: guide.name })"
      >
        {{ $t("components.guide.details") }}
        <svg class="pg-guide__chevron" viewBox="0 0 20 20" aria-hidden="true">
          <path
            d="m5 7 5 5 5-5"
            fill="none"
            stroke="currentColor"
            stroke-width="1.5"
          />
        </svg>
      </summary>
      <div class="pg-guide__detail-body">
        <p class="pg-guide__style-description">
          {{ $t(`components.guide.${mode}Description`) }}
        </p>
        <p class="pg-guide__style-description">
          {{ $t("components.guide.styleHint") }}
        </p>
        <section
          v-if="detailsOpen && guide.tours.length"
          class="pg-guide__tours"
        >
          <h4 class="pg-guide__tours-heading">
            {{
              $t("components.guide.pastTours", { count: guide.tours.length })
            }}
          </h4>
          <ul class="pg-guide__tour-list">
            <li
              v-for="tour in guide.tours"
              :key="tour.id"
              class="pg-guide__tour"
            >
              <div class="pg-guide__tour-image-wrap">
                <img
                  v-if="
                    tour.image &&
                    !failedTourImages.has(`${tour.id}:${tour.image}`)
                  "
                  :key="tour.image"
                  :src="tour.image"
                  :alt="tour.name"
                  class="pg-guide__tour-image"
                  width="64"
                  height="64"
                  loading="lazy"
                  decoding="async"
                  @error="failedTourImages.add(`${tour.id}:${tour.image}`)"
                />
                <span
                  v-else
                  class="pg-guide__tour-image-fallback"
                  aria-hidden="true"
                >
                  <svg viewBox="0 0 24 24" fill="none">
                    <path
                      d="m3 18 6-7 4 4 3-3 5 6M5 5h14v14H5z"
                      stroke="currentColor"
                      stroke-width="1.5"
                    />
                  </svg>
                </span>
              </div>
              <div class="pg-guide__tour-copy">
                <h5 class="pg-guide__tour-name">{{ tour.name }}</h5>
                <p v-if="tour.description" class="pg-guide__tour-description">
                  {{ tour.description }}
                </p>
              </div>
            </li>
          </ul>
        </section>
      </div>
    </details>

    <PGButton class="pg-guide__choose" block @click="selectGuide">
      {{ $t("components.guide.choose", { name: guide.name }) }}
    </PGButton>
  </article>
</template>

<style scoped>
.pg-guide {
  display: grid;
  gap: 1rem;
  min-inline-size: 0;
  padding: 1.25rem;
  border: 1px solid var(--ui-border);
  border-radius: 1.5rem;
  background: var(--ui-bg);
  box-shadow: 0 4px 16px color-mix(in srgb, var(--ui-text) 4%, transparent);
  color: var(--ui-text);
  overflow-wrap: anywhere;
  transition:
    border-color 0.18s ease,
    box-shadow 0.18s ease;
}

.pg-guide--selected {
  border-color: color-mix(
    in srgb,
    var(--ui-primary) 45%,
    var(--ui-text-highlighted)
  );
  box-shadow: 0 0 0 1px var(--ui-primary);
}
@media (hover: hover) {
  .pg-guide:hover {
    border-color: color-mix(in srgb, var(--ui-primary) 45%, var(--ui-border));
  }
}

.pg-guide__identity {
  display: grid;
  grid-template-columns: 5rem minmax(0, 1fr);
  align-items: center;
  gap: 0.875rem;
}

.pg-guide__portrait {
  display: grid;
  place-items: center;
  inline-size: 5rem;
  block-size: 5rem;
  overflow: hidden;
  border: 1px solid var(--ui-border);
  border-radius: 50%;
  background: color-mix(in srgb, var(--ui-primary) 8%, var(--ui-bg-elevated));
}

.pg-guide__avatar {
  inline-size: 100%;
  block-size: 100%;
  object-fit: cover;
}

.pg-guide__initial {
  font-family: Georgia, serif;
  font-size: 2rem;
  color: var(--ui-text-highlighted);
}

.pg-guide__heading {
  display: grid;
  justify-items: start;
  gap: 0.375rem;
  min-inline-size: 0;
}

.pg-guide__name {
  margin: 0;
  text-wrap: balance;
  font-family: Georgia, serif;
  font-size: 1.5rem;
  font-weight: 500;
  line-height: 1.3;
  color: var(--ui-text-highlighted);
}

.pg-guide__mode,
.pg-guide__tag {
  max-inline-size: 100%;
  border-radius: 0.625rem;
  padding: 0.25rem 0.5rem;
  font-size: 0.75rem;
  line-height: 1.4;
  background: var(--ui-bg-elevated);
}

.pg-guide__mode {
  color: var(--ui-text-highlighted);
  background: color-mix(in srgb, var(--ui-primary) 10%, var(--ui-bg));
}

.pg-guide__selected {
  font-size: 0.75rem;
  font-weight: 600;
  color: color-mix(in srgb, var(--ui-primary) 45%, var(--ui-text-highlighted));
}

.pg-guide__context,
.pg-guide__skills {
  margin: 0;
  font-size: 0.875rem;
  line-height: 1.65;
  white-space: pre-line;
}

.pg-guide__preview {
  display: -webkit-box;
  -webkit-box-orient: vertical;
  -webkit-line-clamp: 3;
  overflow: hidden;
}

.pg-guide__skills {
  -webkit-line-clamp: 2;
  color: var(--ui-text-muted);
}

.pg-guide:has(.pg-guide__details[open]) .pg-guide__preview {
  display: block;
  overflow: visible;
  -webkit-line-clamp: unset;
}

.pg-guide__skills-label {
  font-weight: 600;
  color: var(--ui-text);
}

.pg-guide__tags {
  display: flex;
  flex-wrap: wrap;
  gap: 0.375rem;
  margin: 0;
  padding: 0;
  list-style: none;
}

.pg-guide__tag {
  border: 1px solid var(--ui-border);
}

.pg-guide__details {
  min-inline-size: 0;
  border-block-start: 1px solid var(--ui-border);
}

.pg-guide__summary {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 0.75rem;
  min-block-size: 2.75rem;
  list-style: none;
  font-size: 0.875rem;
  font-weight: 600;
  color: var(--ui-text-highlighted);
  cursor: pointer;
}

.pg-guide__summary::-webkit-details-marker {
  display: none;
}

.pg-guide__summary:focus-visible,
.pg-guide__choose:focus-visible {
  outline: 2px solid var(--ui-primary);
  outline-offset: 3px;
  border-radius: 0.5rem;
}

.pg-guide__chevron {
  inline-size: 1.25rem;
  block-size: 1.25rem;
  flex-shrink: 0;
  transition: transform 0.18s ease;
}

.pg-guide__details[open] .pg-guide__chevron {
  transform: rotate(180deg);
}

.pg-guide__detail-body {
  display: grid;
  gap: 1rem;
  padding-block: 0.125rem 0.5rem;
}

.pg-guide__style-description {
  margin: 0;
  font-size: 0.8125rem;
  line-height: 1.6;
  color: var(--ui-text-muted);
}

.pg-guide__tours,
.pg-guide__tour-list {
  display: grid;
  gap: 0.75rem;
}

.pg-guide__tours-heading {
  margin: 0;
  font-size: 0.875rem;
  font-weight: 600;
}

.pg-guide__tour-list {
  margin: 0;
  padding: 0;
  list-style: none;
}

.pg-guide__tour {
  display: grid;
  grid-template-columns: 3.5rem minmax(0, 1fr);
  align-items: start;
  gap: 0.75rem;
}

.pg-guide__tour-image-wrap {
  display: grid;
  place-items: center;
  inline-size: 3.5rem;
  block-size: 3.5rem;
  overflow: hidden;
  border-radius: 0.75rem;
  background: var(--ui-bg-elevated);
}

.pg-guide__tour-image {
  inline-size: 100%;
  block-size: 100%;
  object-fit: cover;
}

.pg-guide__tour-image-fallback {
  inline-size: 1.5rem;
  block-size: 1.5rem;
  color: var(--ui-text-muted);
}

.pg-guide__tour-copy {
  min-inline-size: 0;
}

.pg-guide__tour-name {
  margin: 0;
  font-size: 0.875rem;
  line-height: 1.4;
  font-weight: 600;
  color: var(--ui-text-highlighted);
}

.pg-guide__tour-description {
  margin: 0.25rem 0 0;
  font-size: 0.8125rem;
  line-height: 1.55;
  white-space: pre-line;
  color: var(--ui-text-muted);
}

.pg-guide__choose {
  min-block-size: 3rem;
  border-radius: 0.875rem;
}

@media (prefers-reduced-motion: reduce) {
  .pg-guide,
  .pg-guide__chevron,
  .pg-guide__choose {
    transition: none;
  }
}
</style>
