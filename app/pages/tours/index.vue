<template>
  <section class="tours-page">
    <header class="tours-page__intro">
      <h1 class="pg-page-title">{{ $t("pages.tours.heading") }}</h1>
      <p class="pg-page-description">{{ $t("pages.tours.description") }}</p>
      <PGButton block @click="handleCreateTour">
        {{ $t("pages.tours.createNewTour") }}
      </PGButton>
    </header>
    <div
      v-if="routeStore.error && routeStore.allTours.length"
      class="p-4 text-center"
      role="alert"
    >
      <p>{{ $t("common.loadFailed") }}</p>
      <PGButton @click="routeStore.fetchListTours()">{{
        $t("buttons.tryAgain")
      }}</PGButton>
    </div>
    <div v-if="routeStore.allTours.length" class="tours-page__list">
      <template v-for="tour in routeStore.allTours" :key="tour.id">
        <NativeTourCard
          v-if="tour.route?.walking_plan"
          :tour="tour"
          @updated="routeStore.fetchListTours()"
        />
        <PGTourCard
          v-else
          :description="tour.description"
          :preparationProgress="tour.preparation_progress"
          :latestGenerationId="
            tour.latest_generation_id || tour.active_generation_id
          "
          :researchPreview="tour.research_preview"
          :routeStops="tour.route?.points"
          :generatingText="
            tour.preparation_error
              ? $t('pages.tours.preparationFailed')
              : tour.generating_string
          "
          :status="tour.status"
          :preparationError="tour.preparation_error"
          :guideName="tour.guide?.name || $t('pages.tours.missingGuide')"
          :imageUrl="tour.image"
          :name="tour.name"
          :tourId="tour.id"
          @updated="routeStore.fetchListTours()"
        />
      </template>
    </div>
    <div
      v-else-if="routeStore.isLoading"
      class="tours-page__empty"
      role="status"
    >
      <span class="tours-page__loader" aria-hidden="true" />
      <p>{{ $t("common.loading") }}</p>
    </div>
    <div v-else class="tours-page__empty" role="status">
      <p>
        {{
          routeStore.error ? $t("common.loadFailed") : $t("pages.tours.empty")
        }}
      </p>
      <PGButton v-if="routeStore.error" @click="routeStore.fetchListTours()">{{
        $t("buttons.tryAgain")
      }}</PGButton>
    </div>
    <div v-if="routeStore.loadMoreError" class="tours-page__empty" role="alert">
      <p>{{ $t("pages.tours.loadMoreFailed") }}</p>
      <PGButton
        :disabled="routeStore.isLoading"
        @click="routeStore.loadMoreTours()"
      >
        {{ $t("buttons.tryAgain") }}
      </PGButton>
    </div>
    <p
      v-if="routeStore.isLoadingMore"
      class="text-muted text-center"
      role="status"
    >
      {{ $t("pages.tours.loadingMore") }}
    </p>
    <div
      v-if="routeStore.hasMoreTours"
      ref="listEnd"
      class="h-px"
      aria-hidden="true"
    />
  </section>
</template>

<script lang="ts" setup>
import { definePageMeta } from "#imports";
import { ref, watch } from "vue";
import NativeTourCard from "~/components/tour/NativeTourCard.vue";

definePageMeta({});

const routeStore = useRouteStore();
const listEnd = ref<HTMLElement | null>(null);
const canLoadMore = () =>
  routeStore.hasMoreTours &&
  !routeStore.isLoading &&
  !routeStore.isLoadingMore &&
  !routeStore.loadMoreError;
watch(
  [listEnd, canLoadMore, () => routeStore.allTours.length],
  ([target, enabled], _, onCleanup) => {
    if (!target || !enabled || typeof IntersectionObserver === "undefined")
      return;
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry?.isIntersecting && canLoadMore())
          void routeStore.loadMoreTours();
      },
      { rootMargin: "0px 0px 300px" },
    );
    observer.observe(target);
    onCleanup(() => observer.disconnect());
  },
  { flush: "post" },
);
void routeStore.fetchListTours();
onBeforeUnmount(() => routeStore.stopPolling());

const router = useRouter();

const handleCreateTour = () => {
  router.push({ name: "guides" });
};
</script>

<style scoped>
.tours-page {
  display: grid;
  align-content: start;
  gap: 1.5rem;
  width: 100%;
  padding: 1.5rem 1rem 2rem;
}
.tours-page__intro {
  display: grid;
  gap: 0.875rem;
}
.tours-page__list {
  display: grid;
  gap: 1rem;
  min-inline-size: 0;
}
.tours-page__empty {
  display: grid;
  justify-items: center;
  gap: 1rem;
  padding: 2rem 1.25rem;
  border: 1px dashed var(--ui-border);
  border-radius: 1.25rem;
  color: var(--ui-text-muted);
  text-align: center;
}
.tours-page__loader {
  width: 2rem;
  height: 2rem;
  border: 2px solid var(--ui-border);
  border-top-color: var(--ui-primary);
  border-radius: 50%;
  animation: spin 1s linear infinite;
}
@keyframes spin {
  to {
    transform: rotate(360deg);
  }
}
@media (prefers-reduced-motion: reduce) {
  .tours-page__loader {
    animation: none;
  }
}
</style>
