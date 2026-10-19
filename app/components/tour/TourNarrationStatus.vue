<script setup lang="ts">
import { computed } from "vue";
import type { ITourRecord } from "~/types";

const props = defineProps<{
  record: ITourRecord | null;
  notice: ITourRecord | null;
  bufferStatus: string;
  busy: boolean;
  canPrepare?: boolean;
}>();
const emit = defineEmits<{
  reconcile: [];
  prepare: [];
}>();
const story = computed(() => {
  const value = props.record?.story;
  return value?.chunk_count === 1 && value.is_final ? null : value;
});
const block = computed(
  () => props.notice?.playback_block ?? props.record?.playback_block,
);
const reason = computed(() => {
  if (block.value?.reason === "requires_prepared_generation")
    return "requires_prepared_generation";
  const value =
    props.notice?.narration_status ??
    (props.notice ? undefined : props.record?.narration_status) ??
    block.value?.reason ??
    "";
  if (value.includes("insufficient")) return "insufficient";
  if (value.includes("budget")) return "budget";
  if (
    [
      "paused",
      "explicit_resume_required",
      "pending_route_choice",
      "duration_zero",
      "tour_complete",
      "requested_silence",
      "no_supported_material",
      "short_supported_fallback",
      "evidence_gap",
      "navigation",
    ].includes(value)
  )
    return value;
  if (
    block.value?.active_segment_id ||
    value === "active_segment_unacknowledged"
  )
    return null;
  if (value === "full_supported_fallback") return null;
  if (/pending|prepar|research/.test(value)) return "pending";
  if (value || (props.notice && !props.notice.message.trim()))
    return "unavailable";
  return null;
});
const bufferReason = computed(() =>
  [
    "preparing",
    "prepared",
    "activating",
    "uncertain",
    "exhausted",
    "unavailable",
    "reconciling",
  ].includes(props.bufferStatus)
    ? props.bufferStatus
    : null,
);
</script>

<template>
  <section
    v-if="story || reason || bufferReason"
    class="mx-4 grid gap-2 rounded-lg border border-neutral-300 p-3 text-sm dark:border-neutral-700"
    data-testid="narration-status"
    :aria-label="$t('narration.title')"
  >
    <p v-if="story" role="status" data-testid="story-progress">
      {{
        $t("narration.progress", {
          chunk: story.chunk_index + 1,
          chunks: story.chunk_count,
          sentences: story.sentence_count,
          total: story.total_sentences,
        })
      }}
      {{
        story.is_final && story.chunk_count > 1
          ? $t("narration.finalChunk")
          : ""
      }}
    </p>
    <p v-if="reason" role="status" data-testid="narration-reason">
      {{ $t(`narration.${reason}`) }}
    </p>
    <p v-if="bufferReason" role="status" data-testid="story-buffer-status">
      {{ $t(`narration.buffer.${bufferReason}`) }}
    </p>
    <div class="flex flex-wrap gap-2">
      <PGButton
        v-if="reason === 'requires_prepared_generation' && canPrepare"
        data-testid="open-story-preparation"
        :disabled="busy"
        variant="outline"
        @click="emit('prepare')"
        >{{ $t("narration.openPreparation") }}</PGButton
      >
      <PGButton
        v-if="bufferStatus === 'uncertain'"
        data-testid="reconcile-story"
        :disabled="busy"
        variant="outline"
        @click="emit('reconcile')"
        >{{ $t("narration.reconcile") }}</PGButton
      >
    </div>
  </section>
</template>
