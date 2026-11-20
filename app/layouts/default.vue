<template>
  <div class="default-layout">
    <AppHeader />
    <main class="default-layout__main">
      <slot />
    </main>
  </div>
</template>

<style scoped>
.default-layout {
  display: flex;
  flex-direction: column;
  align-items: center;
  width: 100%;
  min-height: 100dvh;
  flex: 1 0 auto;
}
@media (min-width: 769px) {
  .default-layout {
    min-height: 100%;
  }
}

.default-layout__main {
  width: 100%;
  container: main / inline-size;
  display: flex;
  flex: 1 1 0;
  flex-direction: column;
  align-items: center;
}
.default-layout:has([data-walking-screen]) > :deep(.app-header) {
  display: none;
}
</style>
