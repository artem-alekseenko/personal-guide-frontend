import { computed, onScopeDispose, ref, shallowRef, watch } from "vue";
import type { ICreatedTour } from "~/types";
import type { PreparationProgress } from "#shared/types/preparationProgress";
import type {
  GenerationSummary,
  ResearchActionKind,
  ResearchEnrichment,
  ResearchFile,
  ResearchPendingAction,
} from "#shared/types/researchLifecycle";
import { useTourResearchApi } from "~/composables/api/tours/useTourResearchApi";
import {
  useResearchLifecycleStore,
  type ResearchMutationResult,
} from "~/stores/researchLifecycleStore";
import { useTourRequestStore } from "~/stores/tourRequestStore";
import { useUserStore } from "~/stores/userStore";
import { useTourStore } from "~/stores/tourStore";

export function useTourResearchLifecycle(
  tourId: () => string,
  latestGenerationId: () => string | null,
) {
  const api = useTourResearchApi();
  const operations = useResearchLifecycleStore();
  const requests = useTourRequestStore();
  const users = useUserStore();
  const sourceTour = ref<ICreatedTour | null>(null);
  const generations = ref<GenerationSummary[]>([]);
  const selectedId = shallowRef<string | null>(null);
  const progress = ref<PreparationProgress | null>(null);
  const files = ref<ResearchFile[]>([]);
  const enrichment = ref<ResearchEnrichment | null>(null);
  const loading = shallowRef(false);
  const failed = shallowRef(false);
  const downloadBusy = shallowRef(false);
  const localActionFailed = shallowRef(false);
  let scopeEpoch = 0;
  let refreshEpoch = 0;
  let detailEpoch = 0;
  const initialized = shallowRef(false);

  watch(
    [tourId, () => users.user?.uid],
    () => {
      scopeEpoch++;
      refreshEpoch++;
      detailEpoch++;
      sourceTour.value = null;
      generations.value = [];
      selectedId.value = null;
      progress.value = null;
      files.value = [];
      enrichment.value = null;
      loading.value = false;
      failed.value = false;
      downloadBusy.value = false;
      localActionFailed.value = false;
      initialized.value = false;
    },
    { flush: "sync" },
  );
  onScopeDispose(() => {
    scopeEpoch++;
    refreshEpoch++;
    detailEpoch++;
  });

  const pending = computed<ResearchPendingAction | null>(
    () => operations.forTour(tourId()) ?? null,
  );
  const busy = computed(
    () =>
      !!pending.value?.busy || requests.isBusy(tourId()) || downloadBusy.value,
  );
  const actionFailed = computed(
    () => !!pending.value?.failed || localActionFailed.value,
  );
  const previewBlocked = computed(
    () => !!pending.value || requests.isBusy(tourId()),
  );
  const mutationBlocked = computed(
    () =>
      !users.user?.uid ||
      !initialized.value ||
      !sourceTour.value ||
      !!sourceTour.value.research_preview ||
      loading.value ||
      busy.value ||
      failed.value ||
      !!pending.value ||
      operations.previewUncertain(tourId()),
  );
  const selectedGeneration = computed(
    () =>
      generations.value.find(
        (item) => item.generation_id === selectedId.value,
      ) ?? null,
  );
  const canCancel = computed(
    () =>
      !mutationBlocked.value &&
      (selectedGeneration.value?.status === "PENDING" ||
        selectedGeneration.value?.status === "RUNNING"),
  );
  const canRegenerate = computed(
    () =>
      !mutationBlocked.value &&
      !generations.value.some(
        (item) => item.status === "PENDING" || item.status === "RUNNING",
      ),
  );
  const canAccept = computed(
    () =>
      !mutationBlocked.value &&
      selectedGeneration.value?.status === "READY" &&
      !selectedGeneration.value.experimental_preview &&
      sourceTour.value?.status !== "STARTED" &&
      selectedId.value ===
        (sourceTour.value?.latest_generation_id ||
          latestGenerationId() ||
          generations.value[0]?.generation_id) &&
      sourceTour.value?.playback_generation_id !== selectedId.value,
  );
  const canFinishEarly = computed(
    () =>
      !mutationBlocked.value &&
      selectedGeneration.value?.status === "RUNNING" &&
      selectedGeneration.value.stage === "RESEARCH" &&
      !selectedGeneration.value.experimental_preview &&
      !selectedGeneration.value.finish_early_requested &&
      progress.value?.generation_id === selectedId.value &&
      progress.value.completed_stops >= 1,
  );

  function syncActiveMetadata(source: ICreatedTour) {
    const tours = useTourStore();
    const active = tours.tour;
    if (
      !active ||
      active.id !== source.id ||
      active.user_id !== source.user_id ||
      active.research_preview ||
      source.research_preview
    )
      return;
    // Research progress is independent of the accepted narration package.
    // Do not reset its record, transcript, recovery or generation pins.
    tours.setTour({
      ...active,
      latest_generation_id: source.latest_generation_id,
      status: source.status,
      preparation_error: source.preparation_error,
      preparation_progress: source.preparation_progress,
      generating_percent: source.generating_percent,
      generating_string: source.generating_string,
      generated_at: source.generated_at,
    });
  }
  function applyGeneration(generation: GenerationSummary) {
    const index = generations.value.findIndex(
      (item) => item.generation_id === generation.generation_id,
    );
    if (index === -1) generations.value = [generation, ...generations.value];
    else
      generations.value = generations.value.map((item, position) =>
        position === index ? generation : item,
      );
  }
  async function inspectSelected() {
    const id = tourId();
    const generationId = selectedId.value;
    const uid = users.user?.uid;
    if (!uid || !generationId) return;
    const scope = scopeEpoch;
    const request = ++detailEpoch;
    try {
      const response = await api.detail(id, generationId);
      if (
        scope !== scopeEpoch ||
        request !== detailEpoch ||
        selectedId.value !== generationId
      )
        return;
      if (response.generation.owner_id !== sourceTour.value?.user_id)
        throw new Error("The selected generation owner changed");
      applyGeneration(response.generation);
      progress.value = response.progress ?? null;
    } catch {
      if (scope === scopeEpoch && request === detailEpoch) failed.value = true;
    }
  }
  async function selectGeneration(id: string) {
    if (
      pending.value ||
      busy.value ||
      operations.previewUncertain(tourId()) ||
      !generations.value.some((item) => item.generation_id === id)
    )
      return;
    if (selectedId.value !== id) progress.value = null;
    selectedId.value = id;
    await inspectSelected();
  }
  const selectedGenerationId = computed({
    get: () => selectedId.value,
    set: (id: string | null) => {
      if (id) void selectGeneration(id);
    },
  });

  async function refresh() {
    const id = tourId();
    const uid = users.user?.uid;
    if (!uid || !id) {
      failed.value = true;
      return;
    }
    const scope = scopeEpoch;
    const request = ++refreshEpoch;
    const selection = detailEpoch;
    loading.value = true;
    failed.value = false;
    try {
      const [source, history, saved, background] = await Promise.all([
        api.source(id),
        api.history(id, () => scope === scopeEpoch && request === refreshEpoch),
        api.research(id),
        api.enrichment(id),
      ]);
      if (scope !== scopeEpoch || request !== refreshEpoch) return;
      if (history.some((item) => item.owner_id !== source.user_id))
        throw new Error("The generation history owner changed");
      sourceTour.value = source;
      const selected = selectedGeneration.value;
      generations.value =
        selection !== detailEpoch && selected
          ? history.map((item) =>
              item.generation_id === selected.generation_id ? selected : item,
            )
          : history;
      files.value = saved;
      enrichment.value = background;
      initialized.value = true;
      operations.reconcile(id, source, history);
      syncActiveMetadata(source);
      if (!selectedId.value)
        selectedId.value =
          source.latest_generation_id ||
          latestGenerationId() ||
          history[0]?.generation_id ||
          null;
      // A refresh never changes a visitor's explicit selection, and an older
      // refresh cannot replace progress fetched for a newer selection.
      if (selection === detailEpoch) await inspectSelected();
    } catch {
      if (scope === scopeEpoch && request === refreshEpoch) failed.value = true;
    } finally {
      if (scope === scopeEpoch && request === refreshEpoch)
        loading.value = false;
    }
  }
  function applyMutation(result: ResearchMutationResult) {
    // Invalidate outstanding read responses before installing the confirmed
    // mutation; otherwise a slow pre-mutation refresh could restore old pins.
    refreshEpoch++;
    detailEpoch++;
    loading.value = false;
    if (result.tour) {
      sourceTour.value = result.tour;
      syncActiveMetadata(result.tour);
    }
    if (result.generation) {
      applyGeneration(result.generation);
      if (result.generation.idempotency_key)
        selectedId.value = result.generation.generation_id;
    }
    progress.value = null;
    localActionFailed.value = false;
  }
  async function run(kind: ResearchActionKind): Promise<boolean> {
    if (
      !(kind === "cancel"
        ? canCancel.value
        : kind === "regenerate"
          ? canRegenerate.value
          : kind === "finish-early"
            ? canFinishEarly.value
            : canAccept.value)
    )
      return false;
    const scope = scopeEpoch;
    const id = tourId();
    const result = await operations.start(
      id,
      kind,
      selectedId.value,
      sourceTour.value!.user_id,
      () => scope === scopeEpoch && tourId() === id,
    );
    if (!result || scope !== scopeEpoch) return false;
    applyMutation(result);
    await refresh();
    return scope === scopeEpoch;
  }
  async function retry(): Promise<boolean> {
    if (!pending.value || busy.value) return false;
    const scope = scopeEpoch;
    const id = tourId();
    const result = await operations.retry(
      id,
      () => scope === scopeEpoch && tourId() === id,
    );
    if (!result || scope !== scopeEpoch) return false;
    applyMutation(result);
    await refresh();
    return scope === scopeEpoch;
  }
  async function downloadFile(file: ResearchFile) {
    if (
      !users.user?.uid ||
      downloadBusy.value ||
      !files.value.some((entry) => entry.artifact_id === file.artifact_id)
    )
      return;
    const scope = scopeEpoch;
    const id = tourId();
    downloadBusy.value = true;
    localActionFailed.value = false;
    try {
      // Ignore the backend-provided URL: only the fixed private bytes route is
      // permitted, and the authenticated API client supplies the bearer token.
      const blob = await api.download(id, file.artifact_id);
      if (scope !== scopeEpoch) return;
      const type = blob.type.split(";", 1)[0]!.toLowerCase();
      if (
        type !== "text/plain" &&
        type !== "application/json" &&
        !/^application\/[a-z0-9.+-]+\+json$/.test(type)
      )
        throw new Error("Unexpected saved research content type");
      const url = URL.createObjectURL(blob);
      try {
        const link = document.createElement("a");
        link.href = url;
        link.download = `research-${file.artifact_id.replace(/[^a-zA-Z0-9_-]/g, "_")}.${type === "text/plain" ? "txt" : "json"}`;
        link.click();
      } finally {
        URL.revokeObjectURL(url);
      }
    } catch {
      if (scope === scopeEpoch) localActionFailed.value = true;
    } finally {
      if (scope === scopeEpoch) downloadBusy.value = false;
    }
  }
  return {
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
    canRegenerate,
    canAccept,
    canFinishEarly,
    previewBlocked,
    mutationBlocked,
    refresh,
    selectGeneration,
    run,
    retry,
    downloadFile,
  };
}
