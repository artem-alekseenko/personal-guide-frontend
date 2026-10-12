import { defineStore } from "pinia";
import { ref, watch } from "vue";
import type { ICreatedTour } from "~/types";
import type {
  GenerationSummary,
  ResearchActionKind,
  ResearchPendingAction,
} from "#shared/types/researchLifecycle";
import { useTourResearchApi } from "~/composables/api/tours/useTourResearchApi";
import { useResearchPreviewStore } from "./researchPreviewStore";
import { useTourRequestStore } from "./tourRequestStore";
import { useTourStore } from "./tourStore";
import { useUserStore } from "./userStore";
import { useExperienceStore } from "./experienceStore";

interface ResearchOperation extends ResearchPendingAction {
  readonly ownerId: string;
}
export interface ResearchMutationResult {
  tour?: ICreatedTour;
  generation?: GenerationSummary;
}

/** One immutable, account-scoped operation survives research control remounts. */
export const useResearchLifecycleStore = defineStore(
  "researchLifecycle",
  () => {
    const users = useUserStore();
    const operations = ref<Record<string, ResearchOperation>>({});
    let epoch = 0;
    watch(
      () => users.user?.uid,
      () => {
        epoch++;
        operations.value = {};
      },
      { flush: "sync" },
    );

    const forTour = (id: string) => operations.value[id];
    function previewUncertain(id: string) {
      const preview = useResearchPreviewStore().forTour(id);
      return !!preview && (preview.busy || preview.opening || !preview.result);
    }
    function invalidateAcceptedTour(id: string, tour: ICreatedTour) {
      const uid = users.user?.uid;
      if (uid && tour.playback_generation_id)
        useExperienceStore().acceptGeneration(
          id,
          uid,
          tour.playback_generation_id,
        );
      const tours = useTourStore();
      if (tours.tour?.id !== id || tours.tour.user_id !== tour.user_id) return;
      // setTour after reset restores persisted recovery: remove the old package's
      // checkpoint first so it cannot return as an in-memory playback receipt.
      try {
        localStorage.removeItem(`pg-playback-${tour.user_id}-${id}`);
      } catch {}
      tours.reset();
      tours.setTour(tour, { restoreRecovery: false });
    }
    function confirmResult(
      operation: ResearchOperation,
      result: ResearchMutationResult,
    ) {
      if (result.generation && result.generation.owner_id !== operation.ownerId)
        throw new Error("The generation owner changed");
      if (
        result.tour &&
        (result.tour.user_id !== operation.ownerId ||
          result.tour.research_preview)
      )
        throw new Error("The source tour owner or research scope changed");
      if (
        operation.kind === "accept" &&
        (result.tour?.active_generation_id !== operation.generationId ||
          result.tour?.playback_generation_id !== operation.generationId ||
          result.tour?.status === "STARTED")
      )
        throw new Error(
          "The prepared version acceptance could not be confirmed",
        );
    }

    async function execute(
      id: string,
      operation: ResearchOperation,
      shouldContinue: () => boolean,
    ) {
      const uid = users.user?.uid;
      if (!uid || operation.busy || previewUncertain(id)) return null;
      const current = epoch;
      const isCurrent = () =>
        epoch === current &&
        users.user?.uid === uid &&
        forTour(id) === operation;
      operation.busy = true;
      operation.failed = false;
      const api = useTourResearchApi();
      try {
        const result = await useTourRequestStore().run(
          id,
          async (): Promise<ResearchMutationResult> => {
            if (!isCurrent() || !shouldContinue())
              throw new Error("The research action scope changed");
            if (previewUncertain(id))
              throw new Error("A research draft operation is still pending");
            if (operation.kind === "regenerate") {
              const response = await api.regenerate(id, operation.key);
              return { tour: response.tour, generation: response.generation };
            }
            if (operation.kind === "cancel") {
              const response = await api.cancel(
                id,
                operation.generationId!,
                operation.key,
              );
              return { generation: response.generation };
            }
            if (operation.kind === "finish-early") {
              const response = await api.finishEarly(
                id,
                operation.generationId!,
                operation.key,
              );
              return { generation: response.generation };
            }
            return {
              tour: await api.accept(
                id,
                operation.generationId!,
                operation.key,
              ),
            };
          },
        );
        if (!isCurrent() || !shouldContinue()) return null;
        confirmResult(operation, result);
        if (operation.kind === "accept" && result.tour)
          invalidateAcceptedTour(id, result.tour);
        delete operations.value[id];
        return result;
      } catch {
        if (isCurrent()) operation.failed = true;
        return null;
      } finally {
        if (isCurrent()) operation.busy = false;
      }
    }
    async function start(
      id: string,
      kind: ResearchActionKind,
      generationId: string | null,
      ownerId: string,
      shouldContinue: () => boolean,
    ) {
      if (
        !users.user?.uid ||
        forTour(id) ||
        previewUncertain(id) ||
        !shouldContinue()
      )
        return null;
      if (kind !== "regenerate" && !generationId) return null;
      operations.value[id] = Object.defineProperties(
        {
          kind,
          generationId: kind === "regenerate" ? null : generationId,
          key: crypto.randomUUID(),
          ownerId,
          busy: false,
          failed: false,
        },
        {
          kind: { writable: false, configurable: false },
          generationId: { writable: false, configurable: false },
          key: { writable: false, configurable: false },
          ownerId: { writable: false, configurable: false },
        },
      );
      return execute(id, forTour(id)!, shouldContinue);
    }
    async function retry(id: string, shouldContinue: () => boolean) {
      const operation = forTour(id);
      return operation ? execute(id, operation, shouldContinue) : null;
    }
    function reconcile(
      id: string,
      source: ICreatedTour,
      generations: GenerationSummary[],
    ) {
      const operation = forTour(id);
      if (
        !users.user?.uid ||
        !operation ||
        operation.busy ||
        source.id !== id ||
        source.user_id !== operation.ownerId ||
        source.research_preview
      )
        return false;
      const generation = generations.find(
        (item) =>
          item.owner_id === operation.ownerId &&
          item.tour_id === id &&
          (operation.kind === "regenerate"
            ? item.idempotency_key === operation.key
            : item.generation_id === operation.generationId),
      );
      // A fresh matching generation can also prove that the requested control
      // is no longer possible. Keep viable uncertain operations replayable.
      const impossible =
        !!generation &&
        (operation.kind === "cancel"
          ? generation.status !== "PENDING" && generation.status !== "RUNNING"
          : operation.kind === "finish-early" &&
            (generation.status !== "RUNNING" ||
              generation.stage !== "RESEARCH"));
      const confirmed =
        operation.kind === "regenerate"
          ? !!generation
          : operation.kind === "cancel"
            ? generation?.status === "CANCELLED"
            : operation.kind === "finish-early"
              ? generation?.finish_early_requested === true
              : source.active_generation_id === operation.generationId &&
                source.playback_generation_id === operation.generationId &&
                source.status !== "STARTED";
      if (!confirmed && !impossible) return false;
      if (operation.kind === "accept") invalidateAcceptedTour(id, source);
      delete operations.value[id];
      return true;
    }
    return { forTour, previewUncertain, start, retry, reconcile };
  },
);
