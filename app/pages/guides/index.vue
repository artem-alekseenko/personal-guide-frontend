<template>
  <section class="guides-page">
    <div v-if="isGuidesListLoading" class="guides-page__loading">
      <p class="guides-page__message">{{ $t("pages.guides.loadingGuides") }}</p>
    </div>
    <div v-else class="guides-page__list">
      <PGGuide v-for="guide in guidesList" :key="guide.id" :guide="guide" />
    </div>
  </section>
</template>

<script lang="ts" setup>
import PGGuide from "~/components/PGGuide.vue";
import { definePageMeta, useGuidesStore } from "#imports";

definePageMeta({});

const guidesStore = useGuidesStore();
const { guidesList, isGuidesListLoading } = storeToRefs(guidesStore);
const { fetchGuidesList } = guidesStore;

if (!isGuidesListLoading.value) {
  fetchGuidesList();
}
</script>

<style scoped>
.guides-page {
  width: 100%;
  max-width: 80rem;
  margin-inline: auto;
  padding-block-start: 1rem;
}

.guides-page__loading {
  padding: 1rem;
}

@media (min-width: 768px) {
  .guides-page__loading {
    padding: 3rem;
  }
}

.guides-page__list {
  display: flex;
  flex-direction: column;
  justify-content: center;
  gap: 1rem;
  padding: 1rem;
}
</style>
