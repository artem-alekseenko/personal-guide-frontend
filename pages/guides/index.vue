<template>
  <!-- <Guides> -->
  <section class="container mx-auto">
    <h1 class="prose p-4 text-2xl font-extrabold md:p-12">Guides</h1>
    <div v-if="isGuidesListLoading" class="p-4 md:p-12">
      <p>Loading guides...</p>
    </div>
    <div v-else class="flex flex-col justify-center gap-4 p-4 md:p-12">
      <PGGuide
        v-for="guide in guidesList"
        :key="guide.id"
        :guide="guide"
        class="flex-1"
      />
    </div>
  </section>
  <!-- </Guides> -->
</template>

<script lang="ts" setup>
import PGGuide from "~/components/PGGuide.vue";
import { definePageMeta, useGuidesStore } from "#imports";

definePageMeta({
  title: "Guides",
  middleware: ["auth"],
});

const guidesStore = useGuidesStore();
const { guidesList, isGuidesListLoading } = storeToRefs(guidesStore);
const { fetchGuidesList } = guidesStore;

if (!isGuidesListLoading.value) {
  fetchGuidesList();
}

const title = "Guides";
useHead({
  title,
});
</script>
