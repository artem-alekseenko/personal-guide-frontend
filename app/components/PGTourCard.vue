<template>
  <div ref="cardRef" class="tour-card">
    <TourCover :src="imageUrl" />
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
          :aria-expanded="isExpanded"
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
      <TourResearchPreviewWarning
        v-if="researchPreview"
        :preview="researchPreview"
        :stops="routeStops"
      />
      <NuxtLink
        :to="`/tours/${encodeURIComponent(tourId)}`"
        class="tour-card__link"
      >
        {{
          $t(
            ["GENERATED", "STARTED", "FINISHED"].includes(status)
              ? "navigation.goToTour"
              : "nativeWalk.viewPreparation",
          )
        }}
      </NuxtLink>
      <TourGenerationStatus
        v-if="!researchPreview"
        :progress="livePreparationProgress"
        :status="status"
        :preparation-error="preparationError"
        :generating-text="generatingText"
        :refresh-failed="preparationRefreshFailed"
      />
    </div>
  </div>
</template>

<script lang="ts" setup>
import TourGenerationStatus from "./tour/TourGenerationStatus.vue";
import TourCover from "./tour/TourCover.vue";
import TourResearchPreviewWarning from "./tour/TourResearchPreviewWarning.vue";
import type { IRoutePoint, ResearchPreview } from "~/types";
import type { PreparationProgress } from "#shared/types/preparationProgress";
import {
  computed,
  nextTick,
  onMounted,
  onBeforeUnmount,
  ref,
  shallowRef,
  toRefs,
  watch,
} from "vue";
import { useTourPreparationProgress } from "~/composables/tour/useTourPreparationProgress";
import { useUserStore } from "~/stores/userStore";

const props = defineProps<{
  status: string;
  preparationError?: string | null;
  preparationProgress?: PreparationProgress | null;
  latestGenerationId?: string | null;
  researchPreview?: ResearchPreview | null;
  routeStops?: IRoutePoint[];
  name: string;
  description: string;
  generatingText: string;
  tourId: string;
  imageUrl: string;
  guideName: string;
}>();
const emit = defineEmits<{ updated: [] }>();

const {
  status,
  preparationError,
  preparationProgress,
  name,
  description,
  generatingText,
  tourId,
  imageUrl,
  guideName,
} = toRefs(props);

const users = useUserStore();
const cardRef = shallowRef<HTMLElement | null>(null);
const cardVisible = shallowRef(false);
const {
  progress: livePreparationProgress,
  refreshFailed: preparationRefreshFailed,
} = useTourPreparationProgress(
  computed(() =>
    props.researchPreview
      ? null
      : {
          id: props.tourId,
          latest_generation_id: props.latestGenerationId,
          preparation_progress: props.preparationProgress,
        },
  ),
  computed(() => users.user?.uid ?? null),
  undefined,
  { visible: cardVisible, onRecovered: () => emit("updated") },
);

const isExpanded = ref(false);
const shouldShowToggle = ref(false);
const descriptionRef = ref<HTMLParagraphElement | null>(null);

const toggleExpanded = () => {
  isExpanded.value = !isExpanded.value;
};

const measureDescription = async () => {
  await nextTick();

  if (!descriptionRef.value) return;

  const element = descriptionRef.value;
  const hadClamped = element.classList.contains(
    "tour-card__description--clamped",
  );

  element.classList.remove("tour-card__description--clamped");
  const fullHeight = element.scrollHeight;
  const computedStyle = getComputedStyle(element);
  const lineHeight = parseFloat(computedStyle.lineHeight) || 24;

  if (hadClamped) {
    element.classList.add("tour-card__description--clamped");
  }

  const maxHeight = lineHeight * 3;
  shouldShowToggle.value = fullHeight > maxHeight;
};
let resizeObserver: ResizeObserver | undefined;
let intersectionObserver: IntersectionObserver | undefined;
watch(
  description,
  () => {
    void measureDescription();
  },
  { flush: "post" },
);
onMounted(() => {
  void measureDescription();
  if (cardRef.value && typeof IntersectionObserver !== "undefined") {
    intersectionObserver = new IntersectionObserver(([entry]) => {
      cardVisible.value = !!entry?.isIntersecting;
    });
    intersectionObserver.observe(cardRef.value);
  }
  if (descriptionRef.value && typeof ResizeObserver !== "undefined") {
    resizeObserver = new ResizeObserver(() => {
      void measureDescription();
    });
    resizeObserver.observe(descriptionRef.value);
  }
});
onBeforeUnmount(() => {
  resizeObserver?.disconnect();
  intersectionObserver?.disconnect();
});
</script>

<style scoped>
.tour-card {
  min-inline-size: 0;
  border: 1px solid var(--ui-border);
  border-radius: 1.25rem;
  background: var(--ui-bg);
  color: var(--ui-text);
  overflow: hidden;
  box-shadow: 0 3px 14px color-mix(in srgb, var(--ui-text) 4%, transparent);
}
.tour-card__content {
  display: grid;
  gap: 0.75rem;
  min-inline-size: 0;
  padding: 1.25rem;
  overflow-wrap: anywhere;
}
.tour-card__title {
  color: var(--ui-text-highlighted);
  font-size: 1.25rem;
  font-weight: 650;
  line-height: 1.35;
}
.tour-card__description {
  font-size: 0.9375rem;
  line-height: 1.65;
  color: var(--ui-text-muted);
}
.tour-card__description--clamped {
  display: -webkit-box;
  -webkit-line-clamp: 3;
  -webkit-box-orient: vertical;
  overflow: hidden;
}
.tour-card__toggle {
  min-block-size: 2.75rem;
  color: var(--ui-text);
  font-size: 0.875rem;
  text-decoration: underline;
  text-underline-offset: 0.2em;
}
.tour-card__guide {
  color: var(--ui-text-muted);
  font-size: 0.875rem;
}
.tour-card__generating-text {
  color: var(--ui-text);
}
.tour-card__link {
  display: flex;
  justify-content: center;
  align-items: center;
  min-block-size: 3rem;
  padding: 0.75rem 1rem;
  border-radius: 0.875rem;
  background: var(--fill-green-700);
  color: white;
  font-weight: 600;
}
.tour-card__link:hover {
  background: var(--fill-green-800);
}
</style>
