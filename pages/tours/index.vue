<template>
  <section class="container mx-auto pb-8">
    <h1 class="prose p-4 text-2xl font-extrabold md:p-12">List of tours</h1>
    <PGButton class="mx-auto block" @click="handleCreateTour">
      Create new tour
    </PGButton>
    <div class="flex flex-col justify-center gap-4 p-4 md:p-12">
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
