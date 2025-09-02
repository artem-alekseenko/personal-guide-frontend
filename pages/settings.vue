<template>
  <section class="container mx-auto px-4 pb-8 md:px-12">
    <UserSettings />
  </section>
</template>

<script lang="ts" setup>
definePageMeta({});

onMounted(() => {
  if (import.meta.client) {
    const route = useRoute();

    nextTick(() => {
      history.replaceState(history.state, "", route.fullPath);
    });
  }
});
</script>
