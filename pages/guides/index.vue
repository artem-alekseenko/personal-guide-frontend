<template>
  <!-- <Guides> -->
  <section class="container mx-auto">
    <h1 class="prose p-4 text-2xl font-extrabold md:p-12">Guides</h1>
    <div class="flex flex-col justify-center gap-4 p-4 md:p-12">
      <PGGuide
        v-for="guide in guides"
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
import { definePageMeta } from "#imports";

definePageMeta({
  title: "Guides",
  middleware: ["auth"],
});

const guides = await useGuides();

// const {initialize, guides} = useGuidesStore();
//
// await callOnce(async () => {
//   initialize();
// })

const title = "Guides";
useHead({
  title,
});
</script>
