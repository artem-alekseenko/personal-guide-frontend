<script setup lang="ts">
import {
  computed,
  nextTick,
  onScopeDispose,
  shallowRef,
  useId,
  watch,
} from "vue";
import type { PreparationProgress } from "#shared/types/preparationProgress";
import type { ResearchActionKind } from "#shared/types/researchLifecycle";
import { useTourResearchLifecycle } from "~/composables/tour/useTourResearchLifecycle";
import { useUserStore } from "~/stores/userStore";
import TourPreparationProgress from "./TourPreparationProgress.vue";
import TourResearchPreviewAction from "./TourResearchPreviewAction.vue";

const props = defineProps<{
  tourId: string;
  status: string;
  latestGenerationId?: string | null;
  preparationProgress?: PreparationProgress | null;
  preparationError?: string | null;
}>();
const emit = defineEmits<{ updated: [] }>();
const users = useUserStore();
const generationSelectId = useId();
const confirmationId = useId();
const opened = shallowRef(false);
const confirmation = shallowRef<ResearchActionKind | null>(null);
const confirmationButton = shallowRef<HTMLButtonElement | null>(null);
const {
  sourceTour,
  generations,
  selectedGenerationId,
  selectedGeneration,
  progress,
  files,
  enrichment,
  loading,
  busy,
  failed,
  actionFailed,
  pending,
  canCancel,
  canFinishEarly,
  canRegenerate,
  canAccept,
  previewBlocked,
  mutationBlocked,
  refresh,
  selectGeneration,
  run,
  retry,
  downloadFile,
} = useTourResearchLifecycle(
  () => props.tourId,
  () =>
    props.latestGenerationId ??
    props.preparationProgress?.generation_id ??
    null,
);
const experimental = computed(() => !!sourceTour.value?.research_preview);
const selectedProgress = computed(() => {
  const id =
    selectedGenerationId.value ??
    props.latestGenerationId ??
    props.preparationProgress?.generation_id;
  if (progress.value?.generation_id === id) return progress.value;
  return props.preparationProgress?.generation_id === id
    ? props.preparationProgress
    : null;
});
const controlsBlocked = computed(
  () => busy.value || loading.value || mutationBlocked.value || !users.user,
);
const previewDisabled = computed(
  () => previewBlocked.value || loading.value || !!confirmation.value,
);
const allowed = (kind: ResearchActionKind) =>
  kind === "cancel"
    ? canCancel.value
    : kind === "finish-early"
      ? canFinishEarly.value
      : kind === "regenerate"
        ? canRegenerate.value
        : canAccept.value;
let epoch = 0;
watch(
  [() => props.tourId, () => users.user?.uid],
  () => {
    epoch++;
    confirmation.value = null;
    opened.value = false;
  },
  { flush: "sync" },
);
onScopeDispose(() => {
  epoch++;
});
watch(
  selectedGenerationId,
  () => {
    confirmation.value = null;
  },
  { flush: "sync" },
);

function toggleDetails(event: Event) {
  const open = (event.target as HTMLDetailsElement).open;
  const firstOpening = open && !opened.value;
  opened.value = open;
  if (firstOpening) void refresh();
}
function requestConfirmation(kind: ResearchActionKind) {
  if (!controlsBlocked.value && allowed(kind)) confirmation.value = kind;
  if (confirmation.value) {
    const current = epoch;
    void nextTick(() => {
      if (current === epoch) confirmationButton.value?.focus?.();
    });
  }
}
async function confirmMutation() {
  const kind = confirmation.value;
  if (!kind || controlsBlocked.value || !allowed(kind)) return;
  const current = epoch;
  confirmation.value = null;
  const confirmed = await run(kind);
  if (confirmed && current === epoch) emit("updated");
}
async function retryMutation() {
  if (busy.value || loading.value || !pending.value || !users.user) return;
  const current = epoch;
  const confirmed = await retry();
  if (confirmed && current === epoch) emit("updated");
}
function changeGeneration(event: Event) {
  if (controlsBlocked.value || confirmation.value) return;
  void selectGeneration((event.target as HTMLSelectElement).value);
}
const knownStages = new Set([
  "CAPTURE",
  "ROUTE",
  "PLAN",
  "RESEARCH",
  "SYNTHESIS",
  "COMPOSITION",
  "REVIEW",
  "PUBLICATION",
]);
const dateFormatter = computed(
  () =>
    new Intl.DateTimeFormat(users.userPreferences.language, {
      dateStyle: "medium",
      timeStyle: "short",
    }),
);
const numberFormatter = computed(
  () =>
    new Intl.NumberFormat(users.userPreferences.language, {
      notation: "compact",
      maximumFractionDigits: 1,
    }),
);
function formatDate(value: string) {
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? "—" : dateFormatter.value.format(date);
}
const knownFileKinds = new Set([
  "research_package_result",
  "stop_research_result",
  "preparation_evidence_audit",
  "research_preview_result",
]);
const generationSequences = computed(
  () =>
    new Map(
      generations.value.map(
        (generation) =>
          [generation.generation_id, generation.sequence] as const,
      ),
    ),
);
</script>

<template>
  <section
    v-if="!experimental"
    class="min-w-0"
    :aria-label="$t('researchControls.title')"
  >
    <TourResearchPreviewAction
      :tour-id="tourId"
      :generation-id="
        selectedGenerationId ??
        latestGenerationId ??
        preparationProgress?.generation_id
      "
      :research-status="
        selectedGeneration?.status ?? preparationProgress?.status
      "
      :status="sourceTour?.status ?? status"
      :preparation-error="preparationError"
      :blocked="previewDisabled"
    />
    <details
      :open="opened"
      class="border-default bg-elevated text-default rounded-lg border p-3 text-sm"
      @toggle="toggleDetails"
    >
      <summary
        class="research-summary min-h-11 cursor-pointer py-2 font-medium"
      >
        {{ $t("researchControls.details") }}
      </summary>
      <div
        v-if="opened"
        class="grid min-w-0 gap-3 pt-2"
        :aria-busy="loading || busy"
      >
        <div class="flex flex-wrap gap-2">
          <button
            type="button"
            class="research-button"
            :disabled="loading || busy"
            @click="refresh"
          >
            {{ $t("researchControls.refresh") }}
          </button>
          <button
            v-if="pending"
            type="button"
            class="research-button"
            :disabled="busy || loading || !users.user"
            @click="retryMutation"
          >
            {{ $t("researchControls.retry") }}
          </button>
        </div>
        <p v-if="loading" role="status">{{ $t("common.loading") }}</p>
        <p v-if="failed" class="text-error" role="alert">
          {{ $t("researchControls.readFailed") }}
        </p>
        <p v-if="actionFailed" class="text-error" role="alert">
          {{ $t("researchControls.actionFailed") }}
        </p>
        <p v-if="pending" role="status">
          {{
            $t(
              busy ? "researchControls.working" : "researchControls.uncertain",
              { action: $t(`researchControls.actions.${pending.kind}`) },
            )
          }}
        </p>
        <p v-else-if="mutationBlocked" role="status">
          {{ $t("researchControls.conflictingOperation") }}
        </p>

        <div v-if="generations.length" class="grid min-w-0 gap-2">
          <label :for="generationSelectId" class="font-medium">{{
            $t("researchControls.history")
          }}</label>
          <select
            :id="generationSelectId"
            :value="selectedGenerationId ?? ''"
            :disabled="controlsBlocked || !!confirmation"
            class="border-default bg-default text-default min-h-11 w-full min-w-0 rounded-md border px-2"
            @change="changeGeneration"
          >
            <option
              v-for="generation in generations"
              :key="generation.generation_id"
              :value="generation.generation_id"
            >
              {{
                $t("researchControls.generation", {
                  sequence: generation.sequence,
                })
              }}
              · {{ $t(`preparationProgress.statuses.${generation.status}`) }} ·
              {{ formatDate(generation.created_at) }}
            </option>
          </select>
          <dl
            v-if="selectedGeneration"
            class="grid grid-cols-2 gap-2 break-words"
          >
            <div>
              <dt class="text-muted">{{ $t("researchControls.status") }}</dt>
              <dd>
                {{
                  $t(
                    `preparationProgress.statuses.${selectedGeneration.status}`,
                  )
                }}
              </dd>
            </div>
            <div>
              <dt class="text-muted">{{ $t("researchControls.stage") }}</dt>
              <dd>
                {{
                  knownStages.has(selectedGeneration.stage)
                    ? $t(
                        `preparationProgress.phases.${selectedGeneration.stage}`,
                      )
                    : selectedGeneration.stage || "—"
                }}
              </dd>
            </div>
            <div class="col-span-2 text-xs">
              <dt class="text-muted">{{ $t("researchControls.updatedAt") }}</dt>
              <dd>
                <time :datetime="selectedGeneration.updated_at">{{
                  formatDate(selectedGeneration.updated_at)
                }}</time>
              </dd>
            </div>
          </dl>
          <p
            v-if="
              selectedGeneration?.error_summary ||
              selectedGeneration?.error_code
            "
            class="text-error break-words"
            role="alert"
          >
            {{
              selectedGeneration.error_summary || selectedGeneration.error_code
            }}
          </p>
          <p
            v-if="selectedGeneration?.experimental_preview"
            class="border-warning text-default border-l-2 pl-2"
          >
            {{ $t("researchControls.experimentalGeneration") }}
          </p>
          <TourPreparationProgress
            v-if="selectedProgress"
            :progress="selectedProgress"
            :refreshing="loading"
            :refresh-failed="failed"
            compact
          />
        </div>
        <p v-else-if="!loading && !failed" class="text-muted">
          {{ $t("researchControls.noGenerations") }}
        </p>

        <p
          v-if="selectedGeneration?.finish_early_requested"
          class="border-warning text-default border-l-2 pl-2"
          role="status"
        >
          {{ $t("researchControls.earlyRequested") }}
        </p>
        <p
          v-else-if="
            selectedGeneration?.status === 'RUNNING' &&
            selectedGeneration.stage === 'RESEARCH' &&
            !canFinishEarly &&
            !pending
          "
          class="text-muted"
        >
          {{ $t("researchControls.earlyHint") }}
        </p>
        <div v-if="!pending && !mutationBlocked" class="grid gap-2">
          <h3
            v-if="canCancel || canFinishEarly || canRegenerate || canAccept"
            class="font-medium"
          >
            {{ $t("researchControls.availableActions") }}
          </h3>
          <button
            v-if="canFinishEarly"
            type="button"
            class="research-button text-left"
            :disabled="controlsBlocked || !!confirmation"
            @click="requestConfirmation('finish-early')"
          >
            {{ $t("researchControls.actions.finish-early") }}
          </button>
          <button
            v-if="canAccept"
            type="button"
            class="research-button text-left"
            :disabled="controlsBlocked || !!confirmation"
            @click="requestConfirmation('accept')"
          >
            {{ $t("researchControls.actions.accept") }}
          </button>
          <button
            v-if="canRegenerate"
            type="button"
            class="research-button text-left"
            :disabled="controlsBlocked || !!confirmation"
            @click="requestConfirmation('regenerate')"
          >
            {{ $t("researchControls.actions.regenerate") }}
          </button>
          <button
            v-if="canCancel"
            type="button"
            class="research-button text-left"
            :disabled="controlsBlocked || !!confirmation"
            @click="requestConfirmation('cancel')"
          >
            {{ $t("researchControls.actions.cancel") }}
          </button>
        </div>
        <div
          v-if="confirmation"
          role="group"
          :aria-labelledby="confirmationId"
          class="border-warning grid gap-2 rounded-md border p-3"
        >
          <p :id="confirmationId">
            {{ $t(`researchControls.confirmations.${confirmation}`) }}
          </p>
          <div class="flex flex-wrap gap-2">
            <button
              ref="confirmationButton"
              type="button"
              class="research-button"
              :disabled="controlsBlocked || !allowed(confirmation)"
              @click="confirmMutation"
            >
              {{ $t(`researchControls.actions.${confirmation}`) }}
            </button>
            <button
              type="button"
              class="research-button"
              :disabled="busy"
              @click="confirmation = null"
            >
              {{ $t("common.cancel") }}
            </button>
          </div>
        </div>
        <p
          v-if="selectedGeneration?.status === 'READY' && !canAccept"
          class="text-muted text-xs"
        >
          {{ $t("researchControls.acceptNotice") }}
        </p>

        <details class="border-default min-w-0 border-t pt-2">
          <summary
            class="research-summary min-h-11 cursor-pointer py-2 font-medium"
          >
            {{ $t("researchControls.files")
            }}<span v-if="!loading && !failed"> ({{ files.length }})</span>
          </summary>
          <p class="text-muted my-2">
            {{ $t("researchControls.archiveNotice") }}
          </p>
          <ul v-if="files.length" class="grid gap-3">
            <li
              v-for="file in files"
              :key="file.artifact_id"
              class="research-file border-default grid min-w-0 gap-1 border-t pt-3 break-words"
            >
              <p class="font-medium">
                {{
                  $t(
                    `researchControls.fileKinds.${knownFileKinds.has(file.kind) ? file.kind : "other"}`,
                  )
                }}
              </p>
              <p class="text-muted text-xs">
                <span v-if="generationSequences.has(file.generation_id)"
                  >{{
                    $t("researchControls.generation", {
                      sequence: generationSequences.get(file.generation_id),
                    })
                  }}
                  ·
                </span>
                <time :datetime="file.created_at">{{
                  formatDate(file.created_at)
                }}</time>
                ·
                {{
                  $t("researchControls.bytes", {
                    count: numberFormatter.format(file.byte_size),
                  })
                }}
              </p>
              <button
                type="button"
                class="research-button justify-self-start"
                :disabled="busy || loading || !users.user"
                :aria-label="
                  $t('researchControls.downloadFile', {
                    kind: file.kind,
                    id: file.artifact_id,
                  })
                "
                @click="downloadFile(file)"
              >
                {{ $t("researchControls.download") }}
              </button>
            </li>
          </ul>
          <p v-else-if="!loading && !failed" class="text-muted my-2">
            {{ $t("researchControls.noFiles") }}
          </p>
        </details>
        <details class="border-default min-w-0 border-t pt-2">
          <summary
            class="research-summary min-h-11 cursor-pointer py-2 font-medium"
          >
            {{ $t("researchControls.enrichment") }}
          </summary>
          <p class="text-muted my-2">
            {{ $t("researchControls.enrichmentNotice") }}
          </p>
          <dl v-if="enrichment" class="grid grid-cols-2 gap-2 break-words">
            <div>
              <dt class="text-muted">{{ $t("researchControls.status") }}</dt>
              <dd>
                {{
                  $t(`researchControls.enrichmentStatuses.${enrichment.status}`)
                }}
              </dd>
            </div>
            <div>
              <dt class="text-muted">
                {{ $t("researchControls.enrichmentCounts") }}
              </dt>
              <dd>
                {{
                  $t("researchControls.enrichmentSummary", {
                    rounds: enrichment.rounds,
                    items: enrichment.items.length,
                  })
                }}
              </dd>
            </div>
            <div v-if="enrichment.reason" class="col-span-2">
              <dt class="text-muted">{{ $t("researchControls.reason") }}</dt>
              <dd>{{ enrichment.reason }}</dd>
            </div>
            <div v-if="enrichment.updated_at" class="col-span-2 text-xs">
              <dt class="text-muted">{{ $t("researchControls.updatedAt") }}</dt>
              <dd>
                <time :datetime="enrichment.updated_at">{{
                  formatDate(enrichment.updated_at)
                }}</time>
              </dd>
            </div>
          </dl>
          <p
            v-if="enrichment?.error"
            class="text-error break-words"
            role="alert"
          >
            {{ enrichment.error }}
          </p>
          <p
            v-else-if="!enrichment && !loading && !failed"
            class="text-muted my-2"
          >
            {{ $t("researchControls.noEnrichment") }}
          </p>
        </details>
      </div>
    </details>
  </section>
</template>

<style scoped>
.research-button {
  min-height: 2.75rem;
  max-width: 100%;
  padding: 0.5rem 0.75rem;
  border: 1px solid var(--ui-border);
  border-radius: 0.375rem;
  background: var(--ui-bg);
  color: var(--ui-text);
  cursor: pointer;
  touch-action: manipulation;
}
.research-button:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}
.research-button:focus-visible {
  outline: 2px solid var(--ui-primary);
  outline-offset: 2px;
}
.research-button:hover:not(:disabled) {
  background: var(--ui-bg-accented);
}
.research-summary {
  touch-action: manipulation;
}
.research-summary:focus-visible {
  outline: 2px solid var(--ui-primary);
  outline-offset: 2px;
  border-radius: 0.375rem;
}
.research-file {
  content-visibility: auto;
  contain-intrinsic-size: auto 7rem;
}
</style>
