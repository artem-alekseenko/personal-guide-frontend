<template>
  <h1 class="prose p-4 md:p-12 font-extrabold text-2xl">Guides</h1>
  <div class="flex flex-col justify-center gap-4 p-4 md:p-12">
    <PGGuide
        v-for="guide in guides"
        :key="guide.id"
        :guide="guide"
        class="flex-1"
    />
  </div>
</template>

<script lang="ts" setup>
import {useGuidesStore, useHead} from "#imports";

const {initialize, guides} = useGuidesStore();

await callOnce(async () => {
  initialize();
})

const title = "Guides";
useHead({
  title,
});
</script>
