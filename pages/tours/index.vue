<template>
  <section class="container mx-auto flex flex-grow flex-col pb-8">
    <h1 class="prose p-4 text-2xl font-extrabold md:p-12">List of tours</h1>
    <PGButton class="mx-auto block" @click="handleCreateTour">
      Create new tour
    </PGButton>
    <div
      v-if="routeStore.allTours.length"
      class="flex flex-col justify-center gap-4 p-4 md:p-12"
    >
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
    <div v-else class="flex flex-grow items-center justify-center">
      <UIcon class="size-48 text-gray-600" name="svg-spinners:6-dots-scale" />
    </div>
  </section>
</template>

<script lang="ts" setup>
import { definePageMeta } from "#imports";

definePageMeta({
  title: "Routes",
  middleware: ["auth"],
});

const routeStore = useRouteStore();
routeStore.fetchListTours();

const router = useRouter();

const handleCreateTour = () => {
  router.push({ name: "guides" });
};
</script>
