<template>
  <GuideCatalog
    :guides="guidesList"
    :loading="isGuidesListLoading"
    :error="guidesStore.error"
    :selected-guide-id="guidesStore.selectedGuide?.id"
    @retry="fetchGuidesList"
  />
</template>

<script lang="ts" setup>
import { storeToRefs } from "pinia";
import GuideCatalog from "~/components/guides/GuideCatalog.vue";
import { definePageMeta, useGuidesStore } from "#imports";

definePageMeta({});

const guidesStore = useGuidesStore();
const { guidesList, isGuidesListLoading } = storeToRefs(guidesStore);
const { fetchGuidesList } = guidesStore;

if (!isGuidesListLoading.value) {
  fetchGuidesList();
}
</script>
