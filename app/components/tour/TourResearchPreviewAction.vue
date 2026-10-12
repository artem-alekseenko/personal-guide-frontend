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
  blocked?: boolean;
}>();
const users = useUserStore();
const stopping = computed(() =>
  props.researchStatus
    ? ["PENDING", "RUNNING"].includes(props.researchStatus)
    : props.status === "GENERATING" && !props.preparationError,
);
const {
  confirming,
  busy,
  failed,
  saved,
  creatingNew,
  canCreateNew,
  beginSaved,
  beginNew,
  cancelConfirmation,
  confirm,
} = useTourResearchPreviewAction(
  () => props.tourId,
  () => props.generationId ?? null,
);
</script>

<template>
  <div
    class="border-warning bg-elevated text-default my-3 grid gap-2 rounded-lg border p-3 text-sm"
  >
    <template v-if="!confirming">
      <p class="font-semibold">{{ $t("researchPreview.actionTitle") }}</p>
      <p class="text-muted">{{ $t("researchPreview.actionHint") }}</p>
    </template>
    <PGButton
      v-if="!confirming"
      :variant="['GENERATED', 'STARTED'].includes(status) ? 'outline' : 'solid'"
      color="warning"
      block
      :disabled="busy || blocked || !users.user"
      @click="!blocked && beginSaved()"
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
    <PGButton
      v-if="!confirming && canCreateNew"
      variant="outline"
      color="warning"
      block
      :disabled="busy || blocked || !users.user"
      @click="!blocked && beginNew()"
    >
      {{ $t("researchPreview.newDraft") }}
    </PGButton>
    <template v-if="confirming">
      <p>
        {{
          $t(
            saved && !creatingNew
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
          :disabled="busy || blocked || !users.user"
          :loading="busy"
          @click="!blocked && confirm()"
        >
          {{
            $t(
              failed
                ? "buttons.tryAgain"
                : saved && !creatingNew
                  ? "researchPreview.openSaved"
                  : "researchPreview.confirm",
            )
          }}
        </PGButton>
        <PGButton
          variant="outline"
          :disabled="busy"
          @click="cancelConfirmation"
        >
          {{ $t("common.cancel") }}
        </PGButton>
      </div>
    </template>
    <p v-if="busy" role="status">
      {{
        $t(
          saved && !creatingNew
            ? "researchPreview.opening"
            : "researchPreview.creating",
        )
      }}
    </p>
    <p v-if="failed" class="text-error" role="alert">
      {{
        $t(saved ? "researchPreview.openingFailed" : "researchPreview.failed")
      }}
    </p>
  </div>
</template>
