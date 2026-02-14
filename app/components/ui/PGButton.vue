<template>
  <UButton
    :block="block"
    :class="$attrs.class"
    :color="color"
    :disabled="disabled"
    :loading="loading"
    :variant="variant"
    @click="$emit('click', $event)"
  >
    <slot />
  </UButton>
</template>

<script lang="ts" setup>
import type { PropType } from "vue";

defineProps({
  loading: Boolean,
  block: Boolean,
  disabled: Boolean,
  color: {
    type: String as PropType<
      | "error"
      | "primary"
      | "secondary"
      | "success"
      | "info"
      | "warning"
      | "neutral"
    >,
    default: undefined,
  },
  variant: {
    type: String as PropType<
      "link" | "solid" | "outline" | "soft" | "subtle" | "ghost"
    >,
    default: "solid",
  },
});

defineEmits(["click"]);
</script>
