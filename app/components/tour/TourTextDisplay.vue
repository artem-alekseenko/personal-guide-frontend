<template>
  <div v-if="show" class="flex flex-col gap-y-2 px-4">
    <!-- Note: v-html is safe here as we control the text content and only add highlighting spans -->
    <p
      ref="textRef"
      class="border-primary-500 h-60 overflow-y-auto rounded-md border-2 border-solid p-4"
      v-html="displayText"
    />
    <div class="flex items-baseline justify-items-start gap-x-2">
      <USwitch v-model="isScrollingEnabled" size="xs" />
      <p class="text-sm">{{ toggleScrollText }}</p>
    </div>
  </div>
</template>

<script lang="ts" setup>
import { computed, nextTick, ref, watch } from "vue";
import { createHighlightedText, formatTextWithParagraphs } from "~/utils/textUtils";

interface Props {
  show: boolean;
  text: string;
  highlightSentence?: string;
  scrollToHighlightEnabled?: boolean;
}

interface Emits {
  (e: "update:scrollToHighlightEnabled", value: boolean): void;
}

const props = withDefaults(defineProps<Props>(), {
  highlightSentence: "",
  scrollToHighlightEnabled: true,
});

const emit = defineEmits<Emits>();

const { t } = useI18n();
const textRef = ref<HTMLElement | null>(null);

const isScrollingEnabled = computed({
  get: () => props.scrollToHighlightEnabled,
  set: (value: boolean) => emit("update:scrollToHighlightEnabled", value),
});

const toggleScrollText = computed(() => {
  return isScrollingEnabled.value
    ? t('components.tourTextDisplay.scrollEnabled')
    : t('components.tourTextDisplay.scrollDisabled');
});

const displayText = computed(() => {
  if (!props.text) return "";
  
  if (props.highlightSentence) {
    return createHighlightedText(props.text, props.highlightSentence);
  }
  
  // Format text with proper paragraphs even without highlighting
  const formattedText = formatTextWithParagraphs(props.text);
  return `<p>${formattedText}</p>`;
});

const scrollToHighlightedSentence = () => {
  if (!isScrollingEnabled.value || !textRef.value) return;
  
  const highlightedEl = textRef.value.querySelector(".active-sentence");
  if (!highlightedEl) return;

  highlightedEl.scrollIntoView({
    behavior: "smooth",
    block: "center",
    inline: "nearest",
  });
};

const clearHighlights = () => {
  if (!textRef.value || !props.text) return;
  textRef.value.innerHTML = props.text;
};

// Watch for highlight changes and auto-scroll if enabled
watch(
  () => props.highlightSentence,
  (newSentence) => {
    if (newSentence && isScrollingEnabled.value) {
      // Use nextTick to ensure DOM is updated
      nextTick(() => {
        scrollToHighlightedSentence();
      });
    }
  }
);

// Expose methods for parent component
defineExpose({
  scrollToHighlightedSentence,
  clearHighlights,
});
</script> 