<template>
  <button
    :aria-pressed="props.isSelected"
    :class="chipStyles"
    class="relative inline-flex min-h-11 w-auto max-w-full items-center justify-center rounded-full px-8 py-2 text-center break-words hover:cursor-pointer focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-green-700 dark:focus-visible:outline-green-300"
    type="button"
  >
    <slot />
    <span
      v-if="props.isSelected"
      class="absolute inset-y-0 right-2 my-auto h-4"
    >
      <svg
        aria-hidden="true"
        class="h-full w-full fill-current text-white"
        role="img"
        viewBox="0 0 24 24"
        xmlns="http://www.w3.org/2000/svg"
      >
        <path
          d="M12,2C17.53,2 22,6.47 22,12C22,17.53 17.53,22 12,22C6.47,22 2,17.53 2,12C2,6.47 6.47,2 12,2M15.59,7L12,10.59L8.41,7L7,8.41L10.59,12L7,15.59L8.41,17L12,13.41L15.59,17L17,15.59L13.41,12L17,8.41L15.59,7Z"
        ></path>
      </svg>
    </span>
  </button>
</template>

<script lang="ts" setup>
const props = defineProps<{
  isSelected: boolean;
}>();

const chipStyles = computed(() =>
  [
    props.isSelected
      ? "bg-green-700 text-white hover:bg-green-800"
      : "bg-neutral-200 text-neutral-900 hover:bg-neutral-300 dark:bg-neutral-700 dark:text-white dark:hover:bg-neutral-600",
  ].join(" "),
);
</script>
