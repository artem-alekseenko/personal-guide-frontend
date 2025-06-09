<template>
  <div class="modal-content">
    <!-- Header slot -->
    <header v-if="$slots.header || title" class="modal-header">
      <slot name="header">
        <h3 :id="titleId" class="modal-title">
          {{ title }}
        </h3>
      </slot>
    </header>

    <!-- Main content slot -->
    <main class="modal-body">
      <slot />
    </main>

    <!-- Footer slot -->
    <footer v-if="$slots.footer" class="modal-footer">
      <slot name="footer" />
    </footer>
  </div>
</template>

<script lang="ts" setup>
import type { ModalContentProps } from "~/types/modal";
import { generateStableId } from "~/utils/id";

type Props = ModalContentProps;

const props = defineProps<Props>();

// Generate stable unique title ID if not provided (one time generation)
const generatedTitleId = generateStableId("modal-title");
const titleId = computed(() => props.titleId || generatedTitleId);

defineExpose({
  titleId,
});
</script>

<style scoped>
.modal-content {
  background-color: white;
  border-radius: 0.5rem;
  box-shadow: 0 25px 50px -12px hsla(0, 0%, 0%, 0.25);
  padding: 1.5rem;
}

.dark .modal-content {
  background-color: hsl(215, 28%, 17%);
}

.modal-header {
  margin-bottom: 1rem;
}

.modal-title {
  font-size: 1.125rem;
  font-weight: 600;
  color: hsl(221, 39%, 11%);
}

.dark .modal-title {
  color: white;
}

.modal-subtitle {
  font-size: 0.875rem;
  color: hsl(220, 9%, 46%);
  margin-top: 0.25rem;
}

.dark .modal-subtitle {
  color: hsl(218, 11%, 65%);
}

.modal-body {
  margin-bottom: 1.5rem;
}

.modal-footer {
  display: flex;
  justify-content: flex-end;
  gap: 0.75rem;
}
</style>
