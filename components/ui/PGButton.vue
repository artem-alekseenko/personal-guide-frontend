<template>
  <UButton v-bind="buttonProps" v-on="$attrs">
    <slot />
  </UButton>
</template>

<script lang="ts" setup>
import type { PropType } from "vue";

const props = defineProps({
  loading: Boolean,
  block: Boolean,
  disabled: Boolean,
  variant: {
    type: String as PropType<
      "link" | "solid" | "outline" | "soft" | "subtle" | "ghost"
    >,
    default: "solid",
  },
});

const buttonProps = computed(() => ({
  loading: props.loading,
  block: props.block,
  disabled: props.disabled,
  variant: props.variant,
}));
</script>
