<template>
  <section class="container mx-auto pb-8">
    <h1 class="prose p-4 text-2xl font-extrabold md:p-12">List of tours</h1>
    <div class="flex flex-col justify-center gap-4 p-4 md:p-12">
      <div
        v-for="tour in routeStore.allTours"
        class="lg:grid-row-3 grid grid-cols-1 items-center justify-start justify-items-center gap-x-16 gap-y-4 rounded-xl border border-solid border-lime-200 p-4 shadow-xl hover:border-gray-200 hover:bg-gray-100 md:p-8 lg:w-full lg:grid-cols-4"
      >
        <h2 class="prose">{{ tour.name }}</h2>
        <p class="prose">{{ tour.description }}</p>
        <p v-if="tour.generating_percent !== 100" class="prose">
          Generated percent: {{ tour.generating_percent }}
        </p>
        <p v-else class="prose text-green-800">The tour has been generated!</p>
        <NuxtLink
          v-if="tour.generating_percent === 100"
          :to="`/routes/${tour.id}`"
          class="prose text-blue-800 underline"
        >
          Go to the tour
        </NuxtLink>
      </div>
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
</script>
