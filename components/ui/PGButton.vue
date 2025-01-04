<template>
  <UButton v-bind="buttonProps" v-on="$attrs">
    <slot />
  </UButton>
</template>

<script lang="ts" setup>
const props = defineProps({
  loading: Boolean,
  block: Boolean,
  disabled: Boolean,
  variant: {
    type: String,
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
