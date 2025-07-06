<template>
  <BaseSelector
    :model-value="currentVoiceType"
    :options="voiceTypeOptions"
    :label="$t('pages.settings.voiceType')"
    id="voice-type-select"
    @update:model-value="handleVoiceTypeChange"
  />
</template>

<script lang="ts" setup>
import { computed } from "vue";
import type { IUserPreferences } from "~/types";
import { VOICE_TYPE_OPTIONS, type VoiceType } from "~/types/voice";

interface Props {
  preferences: IUserPreferences;
}
interface Emits {
  (e: "update:preferences", value: IUserPreferences): void;
}

const props = defineProps<Props>();
const emit = defineEmits<Emits>();

const voiceTypeOptions = computed(() => VOICE_TYPE_OPTIONS);

const currentVoiceType = computed(() => props.preferences.voiceType);

const handleVoiceTypeChange = (voiceType: string) => {
  const updatedPreferences: IUserPreferences = {
    ...props.preferences,
    voiceType: voiceType as VoiceType,
  };
  emit("update:preferences", updatedPreferences);
};
</script>

 