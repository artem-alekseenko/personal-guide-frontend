<template>
  <!-- <PGTourCard> -->
  <div :style="{ backgroundImage: `url(${imageUrl})` }" class="tour-card">
    <div class="tour-card__overlay"></div>
    <div class="tour-card__content">
      <h2 class="tour-card__title">{{ name }}</h2>
      <div class="tour-card__description-wrap">
        <p
          ref="descriptionRef"
          :class="[
            'tour-card__description',
            { 'tour-card__description--clamped': !isExpanded },
          ]"
        >
          {{ description }}
        </p>
        <button
          v-if="shouldShowToggle"
          class="tour-card__toggle"
          type="button"
          @click="toggleExpanded"
        >
          {{
            isExpanded
              ? $t("components.tourCard.showLess")
              : $t("components.tourCard.showMore")
          }}
        </button>
      </div>
      <p class="tour-card__guide">
        {{ $t("components.tourCard.guide") }} {{ guideName }}
      </p>
      <p v-if="generatingPercent !== 100" class="tour-card__progress-wrap">
        <UProgress :value="generatingPercent" indicator />
      </p>
      <p class="tour-card__generating-text">{{ generatingText }}</p>
      <NuxtLink
        v-if="generatingPercent === 100"
        :to="`/tours/${tourId}`"
        class="tour-card__link"
      >
        {{ $t("navigation.goToTour") }}
      </NuxtLink>
    </div>
  </div>
</template>

<script lang="ts" setup>
import { nextTick, onMounted, ref, toRefs } from "vue";

const props = defineProps<{
  name: string;
  description: string;
  generatingPercent: number;
  generatingText: string;
  tourId: string;
  imageUrl: string;
  guideName: string;
}>();

const {
  name,
  description,
  generatingPercent,
  generatingText,
  tourId,
  imageUrl,
  guideName,
} = toRefs(props);

const isExpanded = ref(false);
const shouldShowToggle = ref(false);
const descriptionRef = ref<HTMLParagraphElement | null>(null);

const toggleExpanded = () => {
  isExpanded.value = !isExpanded.value;
};

// Check if description is long enough to warrant a toggle button
onMounted(async () => {
  await nextTick();

  if (!descriptionRef.value) return;

  const element = descriptionRef.value;
  const hadClamped = element.classList.contains(
    "tour-card__description--clamped",
  );

  element.classList.remove("tour-card__description--clamped");
  const fullHeight = element.scrollHeight;
  const computedStyle = getComputedStyle(element);
  const lineHeight = parseInt(computedStyle.lineHeight, 10) || 24;

  if (hadClamped) {
    element.classList.add("tour-card__description--clamped");
  }

  const maxHeight = lineHeight * 5;
  shouldShowToggle.value = fullHeight > maxHeight;
});
</script>

<style scoped>
.tour-card {
  container-type: inline-size;
  container-name: tour-card;
  position: relative;
  display: grid;
  grid-template-columns: 1fr;
  align-items: center;
  justify-content: flex-start;
  justify-items: center;
  column-gap: 4rem;
  row-gap: 1rem;
  padding: 1rem;
  border: 0.0625rem solid oklch(0.938 0.127 124.321);
  border-radius: 0.75rem;
  background-size: cover;
  background-position: center;
  box-shadow:
    0 1.25rem 1.5625rem -0.3125rem oklch(0 0 0 / 0.1),
    0 0.5rem 0.625rem -0.375rem oklch(0 0 0 / 0.1);
  transition:
    border-color 0.2s,
    background-color 0.2s;

  @container (width >= 670px) {
    padding: 2rem;
  }

  @container (width >= 926px) {
    inline-size: 100%;
    grid-template-columns: repeat(4, minmax(0, 1fr));
    grid-row: span 3;
  }
}

.tour-card__overlay {
  position: absolute;
  inset: 0;
  border-radius: 0.75rem;
  background: oklch(0 0 0 / 0.7);
}

.tour-card__content {
  position: relative;
  z-index: 10;
}

.tour-card__title {
  font-size: 1.5rem;
  font-weight: 700;
  color: oklch(1 0 0);
}

.tour-card__description-wrap {
  position: relative;
}

.tour-card__description {
  font-size: 1rem;
  font-weight: 600;
  color: oklch(0.968 0.007 247.896);
  transition: all 0.3s;
}

.tour-card__description--clamped {
  display: -webkit-box;
  -webkit-line-clamp: 5;
  -webkit-box-orient: vertical;
  overflow: hidden;
}

.tour-card__toggle {
  display: block;
  margin-block-start: 0.5rem;
  margin-inline-start: auto;
  font-size: 0.875rem;
  color: oklch(0.882 0.059 254.128);
  text-decoration: underline;
  background: none;
  border: none;
  border-radius: 0.25rem;
  cursor: pointer;
  transition: color 0.2s;
}

.tour-card__toggle:hover {
  color: oklch(0.932 0.032 255.585);
}

.tour-card__toggle:focus-visible {
  outline: none;
  box-shadow: 0 0 0 0.125rem oklch(0.809 0.105 251.813 / 0.5);
}

.tour-card__guide {
  color: oklch(0.968 0.007 247.896);
}

.tour-card__progress-wrap {
  margin: 0;
}

.tour-card__generating-text {
  color: oklch(0.925 0.084 155.995);
}

.tour-card__link {
  display: block;
  text-align: end;
  color: oklch(0.932 0.032 255.585);
  text-decoration: underline;
}
</style>
