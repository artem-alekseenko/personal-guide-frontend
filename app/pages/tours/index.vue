<template>
  <section class="tours-page">
    <div class="tours-page__create-btn-wrap">
      <PGButton @click="handleCreateTour">
        {{ $t("pages.tours.createNewTour") }}
      </PGButton>
    </div>
    <div v-if="routeStore.allTours.length" class="tours-page__list">
      <PGTourCard
        v-for="tour in routeStore.allTours"
        :key="tour.id"
        :description="tour.description"
        :generatingPercent="tour.generating_percent"
        :generatingText="tour.generating_string"
        :guideName="tour.guide.name"
        :imageUrl="tour.image"
        :name="tour.name"
        :tourId="tour.id"
      />
    </div>
    <div v-else class="tours-page__empty">
      <UIcon class="tours-page__loader" name="svg-spinners:6-dots-scale" />
    </div>
  </section>
</template>

<script lang="ts" setup>
import { definePageMeta } from "#imports";

definePageMeta({});

const routeStore = useRouteStore();
routeStore.fetchListTours();

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
  container-type: inline-size;
  container-name: tours-list;
  display: flex;
  flex-direction: column;
  justify-content: center;
  gap: 1rem;
  padding: 1rem;

  @container (width >= 420px) {
  }
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
