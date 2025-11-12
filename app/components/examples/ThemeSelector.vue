<template>
  <BaseSelector
    :model-value="currentTheme"
    :options="themeOptions"
    :label="$t('pages.settings.theme')"
    id="theme-select"
    @update:model-value="handleThemeChange"
  />
</template>

<script lang="ts" setup>
import { computed } from "vue";

interface Props {
  theme: string;
}

interface Emits {
  (e: "update:theme", value: string): void;
}

const props = defineProps<Props>();
const emit = defineEmits<Emits>();

const themeOptions = computed(() => [
  {
    value: "light",
    label: "Light Theme",
  },
  {
    value: "dark",
    label: "Dark Theme",
  },
  {
    value: "auto",
    label: "Auto (System)",
  },
]);

const currentTheme = computed(() => props.theme);

const handleThemeChange = (theme: string) => {
  emit("update:theme", theme);
};
</script> 