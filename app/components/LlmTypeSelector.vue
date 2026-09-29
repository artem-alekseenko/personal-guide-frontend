<template>
  <BaseSelector
    :model-value="preferences.llmType"
    :options="options"
    :label="$t('pages.settings.llmType')"
    id="llm-type-select"
    @update:model-value="handleChange"
  />
</template>

<script lang="ts" setup>
import type { IUserPreferences } from "~/types";
import { LLM_TYPES, isValidLlmType } from "~/types/llm";

const props = defineProps<{ preferences: IUserPreferences }>();
const emit = defineEmits<{
  (e: "update:preferences", value: IUserPreferences): void;
}>();
const { t } = useI18n();
const options = computed(() =>
  LLM_TYPES.map((value) => ({ value, label: t(`llmOptions.${value}`) })),
);
const handleChange = (value: string) => {
  if (isValidLlmType(value))
    emit("update:preferences", { ...props.preferences, llmType: value });
};
</script>
