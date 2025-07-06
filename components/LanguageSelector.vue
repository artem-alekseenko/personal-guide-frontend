<template>
  <BaseSelector
    :model-value="currentLanguage"
    :options="languageOptions"
    :label="$t('pages.settings.language')"
    id="language-select"
    @update:model-value="handleLanguageChange"
  />
</template>

<script lang="ts" setup>
import { useI18n } from "vue-i18n";
import { computed, watch } from "vue";
import type { IUserPreferences } from "~/types";

interface Props {
  preferences: IUserPreferences;
}
interface Emits {
  (e: "update:preferences", value: IUserPreferences): void;
}

const props = defineProps<Props>();
const emit = defineEmits<Emits>();

const { setLocale, availableLocales, t } = useI18n();

// Create a type that represents any valid locale code
type LocaleCode = (typeof availableLocales)[number];

const getLabelByCode = (code: string): string => {
  const label = t(`languages.${code}`);
  return label !== `languages.${code}` ? label : code;
};

const languageOptions = computed(() =>
  availableLocales.map((code) => ({
    value: code,
    label: getLabelByCode(code),
  })),
);

const currentLanguage = computed(() => props.preferences.language);

const handleLanguageChange = async (value: string) => {
  const updatedPreferences = {
    ...props.preferences,
    language: value,
  };
  emit("update:preferences", updatedPreferences);
  await setLocale(value as LocaleCode);
};

watch(
  () => props.preferences.language,
  (newLanguage) => {
    if (newLanguage && !availableLocales.includes(newLanguage as LocaleCode)) {
      return;
    }
    setLocale(newLanguage as LocaleCode);
  },
  { immediate: true },
);
</script>
