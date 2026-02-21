<template>
  <section class="settings-page">
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

<style scoped>
.settings-page {
  width: 100%;
  padding-inline: 1rem;
  padding-block-end: 2rem;

  @container main (width > 414px) {
    padding-block-end: 1rem;
  }
}
</style>
