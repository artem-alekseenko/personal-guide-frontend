<script setup lang="ts">
import { computed } from "vue";
import { useUserStore } from "~/stores/userStore";
import { useTourResearchPreviewAction } from "~/composables/tour/useTourResearchPreviewAction";

const props = defineProps<{
  tourId: string;
  generationId?: string | null;
  researchStatus?: string | null;
  status: string;
  preparationError?: string | null;
}>();
const users = useUserStore();
const stopping = computed(() =>
  props.researchStatus
    ? ["PENDING", "RUNNING"].includes(props.researchStatus)
    : props.status === "GENERATING" && !props.preparationError,
);
const { confirming, busy, failed, saved, confirm } =
  useTourResearchPreviewAction(
    () => props.tourId,
    () => props.generationId ?? null,
  );
</script>

<template>
  <div
    class="border-warning bg-elevated text-default my-3 grid gap-2 rounded-lg border p-3 text-sm"
  >
    <PGButton
      v-if="!confirming"
      variant="outline"
      :disabled="busy || !users.user"
      @click="confirming = true"
    >
      {{
        $t(
          saved
            ? "researchPreview.openSaved"
            : stopping
              ? "researchPreview.stopAndTry"
              : "researchPreview.trySaved",
        )
      }}
    </PGButton>
    <template v-else>
      <p>
        {{
          $t(
            saved
              ? "researchPreview.confirmOpen"
              : stopping
                ? "researchPreview.confirmStop"
                : "researchPreview.confirmSaved",
          )
        }}
      </p>
      <p>{{ $t("researchPreview.warning") }}</p>
      <p>{{ $t("researchPreview.noAutomaticPlayback") }}</p>
      <div class="flex flex-wrap gap-2">
        <PGButton
          :disabled="busy || !users.user"
          :loading="busy"
          @click="confirm"
        >
          {{
            $t(
              failed
                ? "buttons.tryAgain"
                : saved
                  ? "researchPreview.openSaved"
                  : "researchPreview.confirm",
            )
          }}
        </PGButton>
        <PGButton
          variant="outline"
          :disabled="busy"
          @click="confirming = false"
        >
          {{ $t("common.cancel") }}
        </PGButton>
      </div>
    </template>
    <p v-if="busy" role="status">
      {{ $t(saved ? "researchPreview.opening" : "researchPreview.creating") }}
    </p>
    <p v-if="failed" class="text-error" role="alert">
      {{
        $t(saved ? "researchPreview.openingFailed" : "researchPreview.failed")
      }}
    </p>
  </div>
</template>
