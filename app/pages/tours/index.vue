<template>
  <section class="tours-page">
    <div class="tours-page__create-btn-wrap">
      <PGButton @click="handleCreateTour">
        {{ $t("pages.tours.createNewTour") }}
      </PGButton>
    </div>
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
      <PGTourCard
        v-for="tour in routeStore.allTours"
        :key="tour.id"
        :description="tour.description"
        :generatingPercent="tour.generating_percent"
        :generatingText="
          tour.preparation_error
            ? $t('pages.tours.preparationFailed')
            : tour.generating_string
        "
        :status="tour.status"
        :preparationError="tour.preparation_error"
        :guideName="tour.guide.name"
        :imageUrl="tour.image"
        :name="tour.name"
        :tourId="tour.id"
      />
    </div>
    <div v-else-if="routeStore.isLoading" class="tours-page__empty">
      <UIcon class="tours-page__loader" name="svg-spinners:6-dots-scale" />
    </div>
    <div v-else class="p-4 text-center" role="status">
      <p>
        {{
          routeStore.error ? $t("common.loadFailed") : $t("pages.tours.empty")
        }}
      </p>
      <PGButton v-if="routeStore.error" @click="routeStore.fetchListTours()">{{
        $t("buttons.tryAgain")
      }}</PGButton>
    </div>
  </section>
</template>

<script lang="ts" setup>
import { definePageMeta } from "#imports";

definePageMeta({});

const routeStore = useRouteStore();
void routeStore.fetchListTours();
onBeforeUnmount(() => routeStore.stopPolling());

const router = useRouter();

const handleCreateTour = () => {
  router.push({ name: "guides" });
};
</script>

<style scoped>
.tours-page {
  display: flex;
  flex-direction: column;
  flex-grow: 1;
  inline-size: 100%;
  max-inline-size: 80rem;
  margin-inline: auto;
  padding-block-start: 1rem;
  padding-block-end: 2rem;
}

.tours-page__create-btn-wrap {
  align-self: center;
}

.tours-page__list {
  display: flex;
  flex-direction: column;
  justify-content: center;
  gap: 1rem;
  padding: 1rem;
}

.tours-page__empty {
  display: flex;
  flex-grow: 1;
  align-items: center;
  justify-content: center;
}

.tours-page__loader {
  inline-size: 12rem;
  block-size: 12rem;
  color: oklch(0.439 0 0);
}
</style>
