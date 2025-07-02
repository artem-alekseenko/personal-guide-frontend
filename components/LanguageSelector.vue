<template>
  <div class="relative">
    <label
      class="mb-2 block text-sm font-medium text-gray-700 dark:text-gray-300"
      for="language-select"
    >
      {{ $t("pages.settings.language") }}
    </label>
    <div class="relative">
      <button
        id="language-select"
        ref="dropdownButton"
        :class="{ 'ring-2 ring-blue-500': isDropdownOpen }"
        class="flex w-full items-center justify-between rounded-md border border-gray-300 bg-white p-2 text-left dark:border-gray-600 dark:bg-gray-700 dark:text-white"
        type="button"
        @click="toggleDropdown"
        @keydown.enter.prevent="toggleDropdown"
        @keydown.space.prevent="toggleDropdown"
        @keydown.escape="closeDropdown"
        @keydown.tab="closeDropdown"
        @keydown.arrow-down.prevent="openDropdown"
        @keydown.arrow-up.prevent="openDropdown"
      >
        <span>{{ getLanguageLabel(currentLanguage) }}</span>
        <svg
          :class="{ 'rotate-180': isDropdownOpen }"
          class="ml-2 h-4 w-4 transition-transform duration-200"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path
            d="M19 9l-7 7-7-7"
            stroke-linecap="round"
            stroke-linejoin="round"
            stroke-width="2"
          />
        </svg>
      </button>

      <!-- Dropdown menu -->
      <div
        v-if="isDropdownOpen"
        ref="dropdownMenu"
        class="absolute z-10 mt-1 w-full rounded-md border border-gray-300 bg-white py-1 shadow-lg dark:border-gray-600 dark:bg-gray-700"
      >
        <button
          v-for="option in languageOptions"
          :key="option.value"
          :class="{
            'bg-blue-50 text-blue-700 dark:bg-blue-900/20 dark:text-blue-400':
              currentLanguage === option.value,
          }"
          class="flex w-full items-center px-3 py-2 text-left text-sm hover:bg-gray-100 dark:text-white dark:hover:bg-gray-600"
          type="button"
          @click="selectLanguage(option.value)"
        >
          {{ option.label }}
        </button>
      </div>
    </div>
  </div>
</template>

<script lang="ts" setup>
import { useI18n } from "vue-i18n";
import { computed, onMounted, onUnmounted, ref, watch } from "vue";
import type { IUserPreferences } from "~/types";

interface Props {
  preferences: IUserPreferences;
}
interface Emits {
  (e: "update:preferences", value: IUserPreferences): void;
}

const props = defineProps<Props>();
const emit = defineEmits<Emits>();

const isDropdownOpen = ref(false);
const dropdownButton = ref<HTMLButtonElement>();
const dropdownMenu = ref<HTMLDivElement>();

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

const getLanguageLabel = (value: string): string => {
  const option = languageOptions.value.find((opt) => opt.value === value);
  return option?.label || value;
};

const toggleDropdown = () => {
  isDropdownOpen.value = !isDropdownOpen.value;
};

const openDropdown = () => {
  isDropdownOpen.value = true;
};

const closeDropdown = () => {
  isDropdownOpen.value = false;
};

const selectLanguage = async (value: string) => {
  if (currentLanguage.value === value) {
    closeDropdown();
    return;
  }
  const updatedPreferences = {
    ...props.preferences,
    language: value,
  };
  emit("update:preferences", updatedPreferences);
  await setLocale(value as LocaleCode);
  closeDropdown();
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

const handleClickOutside = (event: Event) => {
  if (
    dropdownButton.value &&
    dropdownMenu.value &&
    !dropdownButton.value.contains(event.target as Node) &&
    !dropdownMenu.value.contains(event.target as Node)
  ) {
    closeDropdown();
  }
};

onMounted(() => {
  document.addEventListener("click", handleClickOutside);
});
onUnmounted(() => {
  document.removeEventListener("click", handleClickOutside);
});
</script>
