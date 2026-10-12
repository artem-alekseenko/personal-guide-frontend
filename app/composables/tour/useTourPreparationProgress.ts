import {
  computed,
  onScopeDispose,
  shallowRef,
  toValue,
  watch,
  type Ref,
} from "vue";
import { useTourResearchApi } from "~/composables/api/tours/useTourResearchApi";
import { usePreparationMessageStore } from "~/stores/preparationMessageStore";
import type { ICreatedTour } from "~/types";
import type { PreparationProgress } from "#shared/types/preparationProgress";

type PreparationTour = Pick<ICreatedTour, "id" | "preparation_progress"> &
  Partial<Pick<ICreatedTour, "user_id" | "latest_generation_id">>;

// Caption text is pinned to factual work, not just the generation or a timestamp.
const workKey = (value: PreparationProgress) =>
  JSON.stringify([
    value.generation_id,
    value.status,
    value.phase,
    value.active_researchers,
    value.activity_updated_at,
    value.activity_stale === true,
    value.stops.map((stop) => [
      stop.stop_id,
      stop.name,
      stop.status,
      stop.phase,
      stop.attempt,
      stop.updated_at,
    ]),
  ]);
const captionFields = [
  "activity_text",
  "activity_source",
  "activity_model",
  "activity_fallback_reason",
  "activity_generated_at",
] as const;
type Caption = Pick<PreparationProgress, (typeof captionFields)[number]>;

/** Cheap source-authoritative polling and explicit, owner-pinned status writing. */
export function useTourPreparationProgress(
  tour: Readonly<Ref<PreparationTour | null>>,
  firebaseUid: Readonly<Ref<string | null>>,
  language?: Readonly<Ref<string>>,
  options: { visible?: Readonly<Ref<boolean>> } = {},
) {
  const api = useTourResearchApi();
  const messages = usePreparationMessageStore();
  const appLocale =
    language ??
    (useNuxtApp().$i18n as { locale?: Ref<string> | string } | undefined)
      ?.locale;
  const lang = computed(() => (toValue(appLocale) === "ru" ? "ru" : "en"));
  const generationId = () =>
    tour.value?.latest_generation_id ||
    tour.value?.preparation_progress?.generation_id ||
    null;
  const progress = shallowRef<PreparationProgress | null>(null);
  const refreshFailed = shallowRef(false);
  const factualRefreshing = shallowRef(false);
  const pageVisible = shallowRef(
    typeof document !== "undefined" && document.visibilityState !== "hidden",
  );
  const visible = computed(
    () => pageVisible.value && (options.visible?.value ?? true),
  );
  const scope = computed(() => {
    if (!firebaseUid.value || !tour.value || !generationId() || !identity)
      return null;
    return {
      uid: firebaseUid.value,
      ownerId: confirmedOwner.value || tour.value.user_id || "",
      tourId: tour.value.id,
      generationId: generationId()!,
    };
  });
  const captionUncertain = computed(() => {
    const current = scope.value;
    const operation = current && messages.forScope(current);
    return !!operation?.uncertain && !operation.busy;
  });
  const refreshing = computed(
    () =>
      factualRefreshing.value ||
      !!(scope.value && messages.forScope(scope.value)?.busy),
  );
  let revision = 0;
  let sequence = 0;
  let identity = "";
  const confirmedOwner = shallowRef("");
  let rejectedTour: PreparationTour | null = null;
  let caption: { work: string; lang: string; fields: Caption } | null = null;
  let timer: NodeJS.Timeout | undefined;
  let active = true;
  let readVersion: number | null = null;
  const clear = () => {
    clearTimeout(timer);
    timer = undefined;
  };
  const newer = (
    candidate: PreparationProgress,
    previous: PreparationProgress | null,
  ) => {
    if (!previous || previous.generation_id !== candidate.generation_id)
      return true;
    const candidateTime = Date.parse(candidate.updated_at);
    const previousTime = Date.parse(previous.updated_at);
    if (candidateTime < previousTime) return false;
    return (
      candidateTime !== previousTime ||
      candidate.elapsed_seconds === undefined ||
      previous.elapsed_seconds === undefined ||
      candidate.elapsed_seconds >= previous.elapsed_seconds
    );
  };
  function applyFacts(value: PreparationProgress, localized: boolean) {
    if (!newer(value, progress.value)) return;
    if (
      caption &&
      (caption.work !== workKey(value) || caption.lang !== lang.value)
    )
      caption = null;
    if (caption && (!localized || caption.fields.activity_source === "llm")) {
      const safe = { ...value };
      for (const field of captionFields) delete safe[field];
      progress.value = { ...safe, ...caption.fields };
    } else if (localized) {
      const fields: Caption = {
        activity_source: value.activity_source ?? "recorded",
      };
      for (const field of captionFields) {
        if (value[field] !== undefined)
          Object.assign(fields, { [field]: value[field] });
      }
      caption = { work: workKey(value), lang: lang.value, fields };
      progress.value = { ...value, ...fields };
    } else {
      const safe = { ...value };
      for (const field of captionFields) delete safe[field];
      // Source/list captions have no selected-language receipt. Keep their facts only.
      progress.value = safe;
    }
  }
  function schedule() {
    clear();
    if (
      active &&
      identity &&
      generationId() &&
      visible.value &&
      (!progress.value ||
        ["PENDING", "RUNNING"].includes(progress.value.status))
    )
      timer = setTimeout(() => {
        timer = undefined;
        void refresh();
      }, 5000);
  }
  async function refresh(manual = false) {
    const id = tour.value?.id;
    const uid = firebaseUid.value;
    const generation = generationId();
    const owner = tour.value?.user_id;
    const selectedLanguage = lang.value;
    const version = revision;
    if (
      !id ||
      !uid ||
      !generation ||
      !active ||
      !identity ||
      !visible.value ||
      readVersion === version
    )
      return;
    const isCurrent = () =>
      active &&
      revision === version &&
      firebaseUid.value === uid &&
      tour.value?.id === id &&
      tour.value?.user_id === owner &&
      generationId() === generation &&
      lang.value === selectedLanguage;
    const messageVariant = sequence;
    sequence = Math.min(sequence + 1, 2_147_483_647);
    readVersion = version;
    factualRefreshing.value = true;
    let factual: PreparationProgress | null = null;
    try {
      const result = await api.detail(id, generation, {
        lang: selectedLanguage,
        message_variant: messageVariant,
      });
      if (!isCurrent()) return;
      if (owner && result.generation.owner_id !== owner)
        throw new Error("The preparation generation owner changed");
      confirmedOwner.value = result.generation.owner_id;
      // Owner-less list snapshots cannot select a receipt until detail confirms ownership.
      if (scope.value) messages.restore(scope.value);
      if (result.progress) applyFacts(result.progress, true);
      factual = result.progress ? progress.value : null;
      refreshFailed.value = false;
    } catch {
      if (isCurrent()) refreshFailed.value = true;
    } finally {
      if (isCurrent()) {
        factualRefreshing.value = false;
        readVersion = null;
        schedule();
      }
    }
    // No paid status request without a freshly confirmed owner and actual factual work.
    if (
      !isCurrent() ||
      !visible.value ||
      !factual ||
      !scope.value ||
      factual.rich_progress_enabled === false ||
      (!["PENDING", "RUNNING"].includes(factual.status) &&
        !captionUncertain.value)
    )
      return;
    const submittedScope = { ...scope.value };
    const prior = factual.activity_text?.slice(0, 280);
    const result = await messages.request(
      submittedScope,
      {
        lang: selectedLanguage,
        message_variant: messageVariant,
        ...(prior ? { previous_activity_text: prior } : {}),
      },
      manual,
    );
    const operation = messages.forScope(submittedScope);
    // An uncertain request may belong to the old language. Reconcile it, never relabel it.
    if (
      !isCurrent() ||
      !visible.value ||
      !result?.progress ||
      operation?.body.lang !== selectedLanguage ||
      !progress.value ||
      progress.value.rich_progress_enabled === false ||
      workKey(result.progress) !== workKey(progress.value)
    )
      return;
    if (result.progress.rich_progress_enabled === false) {
      progress.value = { ...progress.value, rich_progress_enabled: false };
      return;
    }
    const fields: Caption = {};
    for (const field of captionFields) {
      const value = result.progress[field];
      if (value !== undefined) Object.assign(fields, { [field]: value });
    }
    caption = {
      work: workKey(result.progress),
      lang: selectedLanguage,
      fields,
    };
    // Model responses never replace source-authoritative numbers or newer snapshots.
    const safe = { ...progress.value };
    for (const field of captionFields) delete safe[field];
    progress.value = { ...safe, ...fields };
  }
  watch(
    [
      tour,
      firebaseUid,
      lang,
      generationId,
      () => tour.value?.preparation_progress?.rich_progress_enabled !== false,
    ],
    ([current, uid, selectedLanguage, generation, richEnabled], previous) => {
      const [previousTour, previousUid, previousLanguage] = previous;
      if (previousUid && uid !== previousUid && current === previousTour)
        rejectedTour = current;
      if (!uid || !current || current === rejectedTour) {
        revision++;
        clear();
        identity = "";
        confirmedOwner.value = "";
        caption = null;
        progress.value = null;
        factualRefreshing.value = false;
        refreshFailed.value = false;
        return;
      }
      rejectedTour = null;
      const nextIdentity = JSON.stringify([
        uid,
        current.id,
        current.user_id,
        generation,
      ]);
      const changed = identity !== nextIdentity;
      const languageChanged =
        previousLanguage !== undefined && selectedLanguage !== previousLanguage;
      const richChanged =
        previous[4] !== undefined && previous[4] !== richEnabled;
      if (changed || languageChanged || richChanged) {
        revision++;
        clear();
        caption = null;
        factualRefreshing.value = false;
        refreshFailed.value = false;
        if (changed) {
          sequence = 0;
          confirmedOwner.value = "";
          progress.value = null;
          identity = nextIdentity;
        } else if (progress.value) {
          const safe = { ...progress.value };
          for (const field of captionFields) delete safe[field];
          progress.value = safe;
        }
      }
      const snapshot = current.preparation_progress;
      if (snapshot?.generation_id === generation) applyFacts(snapshot, false);
      if (current.user_id && scope.value) messages.restore(scope.value);
      if (
        progress.value &&
        !["PENDING", "RUNNING"].includes(progress.value.status)
      )
        clear();
      if (changed || languageChanged || richChanged) void refresh();
      // Frequent list updates must not restart or starve the scheduled refresh.
      else if (!timer && readVersion !== revision) schedule();
    },
    { immediate: true, flush: "sync" },
  );
  const onVisibility = () => {
    pageVisible.value = document.visibilityState !== "hidden";
  };
  if (typeof document !== "undefined")
    document.addEventListener("visibilitychange", onVisibility);
  watch(
    visible,
    (current) => {
      if (current) void refresh();
      else clear();
    },
    { flush: "sync" },
  );
  onScopeDispose(() => {
    active = false;
    revision++;
    clear();
    if (typeof document !== "undefined")
      document.removeEventListener("visibilitychange", onVisibility);
  });
  return {
    progress,
    refreshFailed,
    refreshing,
    captionUncertain,
    refresh: () => refresh(true),
  };
}
