<template>
  <section class="container mx-auto flex grow flex-col pt-4 pb-8">
    <PGButton class="mx-auto block" @click="handleCreateTour">
      {{ $t("pages.tours.createNewTour") }}
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
    <div v-else class="flex grow items-center justify-center">
      <UIcon
        class="size-48 text-neutral-600"
        name="svg-spinners:6-dots-scale"
      />
    </div>
  </section>
</template>

<script lang="ts" setup>
import { definePageMeta } from "#imports";

definePageMeta({
  middleware: ["auth"],
});

const routeStore = useRouteStore();
routeStore.fetchListTours();

const router = useRouter();

const handleCreateTour = () => {
  router.push({ name: "guides" });
};
</script>
