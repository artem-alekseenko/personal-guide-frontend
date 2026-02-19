<template>
  <UButton
    v-if="shouldShow"
    :aria-label="$t('common.goBack')"
    class="text-green-500 transition-colors hover:bg-gray-100 dark:text-white dark:hover:bg-gray-700"
    icon="i-heroicons-arrow-left"
    size="sm"
    variant="ghost"
    @click="goBack"
  />
</template>

<script lang="ts" setup>
import { useBackNavigation } from "~/composables/useBackNavigation";

const { shouldShow, goBack } = useBackNavigation();
</script>
