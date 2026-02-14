<template>
  <div class="flex flex-col gap-3">
    <PGButton
      v-for="provider in providers"
      :key="provider.id"
      block
      variant="outline"
      :loading="loadingProvider === provider.id"
      :disabled="loadingProvider !== null || disabled"
      class="inline-flex items-center justify-center gap-2"
      @click="handleClick(provider.id)"
    >
      <UIcon :name="provider.icon" class="h-5 w-5 shrink-0" />
      {{ provider.label }}
    </PGButton>
  </div>
</template>

<script lang="ts" setup>
import { useAuthActions } from "~/composables/useAuthActions";

defineProps<{
  providers: Array<{
    id: "google";
    label: string;
    icon: string;
  }>;
  disabled?: boolean;
}>();

const emit = defineEmits<{
  error: [code: string, message: string];
}>();

const { loginWithGoogle } = useAuthActions();
const loadingProvider = ref<"google" | null>(null);

const handleClick = async (id: "google") => {
  loadingProvider.value = id;
  const result = await loginWithGoogle();
  loadingProvider.value = null;

  if (!result.success && result.errorCode && result.errorMessage) {
    emit("error", result.errorCode, result.errorMessage);
  }
};
</script>
