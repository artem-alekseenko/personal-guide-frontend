<template>
  <h1>Guides</h1>
  <h2 v-if="!guides.data.length">
    {{ guides.message }}
  </h2>
  <PGGuide />
</template>

<script setup lang="ts">
import { useGuides, useHead } from "#imports";

const guides = await useGuides();

const title = "Guides";
useHead({
  title,
});
</script>
