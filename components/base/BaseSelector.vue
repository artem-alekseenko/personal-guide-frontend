<template>
  <div class="base-selector">
    <label
      v-if="label"
      :for="id"
      class="base-selector__label"
    >
      {{ label }}
    </label>
    
    <div class="base-selector__dropdown">
      <button
        :id="id"
        ref="dropdownButton"
        :class="{
          'base-selector__button--open': isDropdownOpen,
        }"
        class="base-selector__button"
        type="button"
        @click="toggleDropdown"
        @blur="handleBlur"
        @keydown.enter.prevent="toggleDropdown"
        @keydown.space.prevent="toggleDropdown"
        @keydown.escape="closeDropdown"
        @keydown.tab="closeDropdown"
        @keydown.arrow-down.prevent="openDropdown"
        @keydown.arrow-up.prevent="openDropdown"
      >
        <span class="base-selector__selected">
          {{ getSelectedLabel() }}
        </span>
        <svg
          class="base-selector__icon"
          :class="{ 'base-selector__icon--rotated': isDropdownOpen }"
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path
            stroke-linecap="round"
            stroke-linejoin="round"
            stroke-width="2"
            d="M19 9l-7 7-7-7"
          />
        </svg>
      </button>

      <div
        v-show="isDropdownOpen"
        ref="dropdownMenu"
        class="base-selector__menu"
      >
        <button
          v-for="option in options"
          :key="option.value"
          :class="{
            'base-selector__option--selected': isOptionSelected(option.value),
          }"
          class="base-selector__option"
          type="button"
          @click="selectOption(option.value)"
        >
          {{ option.label }}
        </button>
      </div>
    </div>
  </div>
</template>

<script lang="ts" setup>
import { computed, onMounted, onUnmounted, ref } from "vue";

interface SelectorOption {
  readonly value: string;
  readonly label: string;
}

interface Props {
  modelValue: string;
  options: readonly SelectorOption[];
  label?: string;
  id?: string;
}

interface Emits {
  (e: "update:modelValue", value: string): void;
}

const props = withDefaults(defineProps<Props>(), {
  label: "",
  id: () => `selector-${Math.random().toString(36).substr(2, 9)}`,
});

const emit = defineEmits<Emits>();

const isDropdownOpen = ref(false);
const dropdownButton = ref<HTMLButtonElement>();
const dropdownMenu = ref<HTMLDivElement>();

const currentValue = computed(() => props.modelValue);

const getSelectedLabel = (): string => {
  const option = props.options.find((opt) => opt.value === currentValue.value);
  return option?.label || currentValue.value;
};

const isOptionSelected = (value: string): boolean => {
  return currentValue.value === value;
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

const selectOption = (value: string) => {
  if (currentValue.value === value) {
    closeDropdown();
    return;
  }
  emit("update:modelValue", value);
  closeDropdown();
};

const handleBlur = (event: FocusEvent) => {
  // Use setTimeout to allow click events to fire first
  setTimeout(() => {
    if (!dropdownButton.value?.contains(event.relatedTarget as Node)) {
      closeDropdown();
    }
  }, 100);
};

const handleClickOutside = (event: Event) => {
  if (
    dropdownButton.value &&
    !dropdownButton.value.contains(event.target as Node) &&
    dropdownMenu.value &&
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

<style scoped>
.base-selector {
  width: 100%;
}

.base-selector__label {
  margin-block-end: 0.5rem;
  display: block;
  font-size: 0.875rem;
  font-weight: 500;
  color: oklch(0.3 0 0);
}

.dark .base-selector__label {
  color: oklch(0.7 0 0);
}

.base-selector__dropdown {
  position: relative;
}

.base-selector__button {
  display: flex;
  width: 100%;
  align-items: center;
  justify-content: space-between;
  border-radius: 0.375rem;
  border: 1px solid oklch(0.8 0 0);
  background-color: white;
  padding-inline: 0.75rem;
  padding-block: 0.5rem;
  text-align: start;
  font-size: 0.875rem;
  box-shadow: 0 1px 2px 0 oklch(0 0 0 / 0.05);
  transition: all 0.2s;
}

.base-selector__button:hover {
  border-color: oklch(0.7 0 0);
}

.base-selector__button:focus {
  border-color: oklch(0.5 0.2 250);
  outline: none;
  box-shadow: 0 0 0 1px oklch(0.5 0.2 250);
}

.base-selector__button--open {
  border-color: oklch(0.5 0.2 250);
  box-shadow: 0 0 0 1px oklch(0.5 0.2 250);
}

.dark .base-selector__button {
  border-color: oklch(0.4 0 0);
  background-color: oklch(0.2 0 0);
  color: white;
}

.dark .base-selector__button:hover {
  border-color: oklch(0.5 0 0);
}

.dark .base-selector__button:focus,
.dark .base-selector__button--open {
  border-color: oklch(0.6 0.2 250);
  box-shadow: 0 0 0 1px oklch(0.6 0.2 250);
}

.base-selector__selected {
  display: block;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.base-selector__icon {
  height: 1.25rem;
  width: 1.25rem;
  color: oklch(0.6 0 0);
  transition: transform 0.2s;
  flex-shrink: 0;
  margin-inline-start: 0.5rem;
}

.base-selector__icon--rotated {
  transform: rotate(180deg);
}

.base-selector__menu {
  position: absolute;
  z-index: 10;
  margin-block-start: 0.25rem;
  max-height: 15rem;
  width: 100%;
  overflow: auto;
  border-radius: 0.375rem;
  background-color: white;
  padding-block: 0.25rem;
  font-size: 1rem;
  box-shadow: 0 10px 15px -3px oklch(0 0 0 / 0.1), 0 4px 6px -4px oklch(0 0 0 / 0.1);
  outline: 1px solid oklch(0 0 0 / 0.05);
}

.base-selector__menu:focus {
  outline: none;
}

.dark .base-selector__menu {
  background-color: oklch(0.2 0 0);
  outline-color: oklch(0.4 0 0);
}

@media (min-width: 640px) {
  .base-selector__menu {
    font-size: 0.875rem;
  }
}

.base-selector__option {
  position: relative;
  display: flex;
  width: 100%;
  cursor: pointer;
  user-select: none;
  align-items: center;
  padding-inline: 0.75rem;
  padding-block: 0.5rem;
  font-size: 0.875rem;
  transition: background-color 0.15s;
}

.base-selector__option:hover {
  background-color: oklch(0.95 0 0);
}

.dark .base-selector__option {
  color: white;
}

.dark .base-selector__option:hover {
  background-color: oklch(0.3 0 0);
}

.base-selector__option--selected {
  background-color: oklch(0.95 0.1 250);
  color: oklch(0.3 0.2 250);
}

.dark .base-selector__option--selected {
  background-color: oklch(0.2 0.1 250);
  color: oklch(0.7 0.2 250);
}
</style> 