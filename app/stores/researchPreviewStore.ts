import { defineStore } from "pinia";
import { ref, watch } from "vue";
import type { ICreatedTour } from "~/types";
import {
  useResearchPreview,
  type ResearchPreviewRequest,
} from "~/composables/api/tours/useResearchPreview";
import { useTourRequestStore } from "./tourRequestStore";
import { useUserStore } from "./userStore";
import { useResearchLifecycleStore } from "./researchLifecycleStore";

interface PreviewOperation {
  key: string;
  body: Readonly<ResearchPreviewRequest>;
  busy: boolean;
  opening: boolean;
  navigationFailed: boolean;
  failed: boolean;
  result: ICreatedTour | null;
}

/** Shared across card/detail remounts; uncertain retries retain their identity. */
export const useResearchPreviewStore = defineStore("researchPreview", () => {
  const users = useUserStore();
  const operations = ref<Record<string, PreviewOperation>>({});
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
  async function start(id: string, generationId: string | null) {
    const uid = users.user?.uid;
    if (!uid) throw new Error("Sign in before trying a draft");
    if (forTour(id)?.busy) return null;
    if (!forTour(id)?.result && useResearchLifecycleStore().forTour(id))
      return null;
    if (!forTour(id)) {
      operations.value[id] = {
        key: crypto.randomUUID(),
        body: Object.freeze({ generation_id: generationId }),
        busy: false,
        opening: false,
        navigationFailed: false,
        failed: false,
        result: null,
      };
    }
    const operation = forTour(id)!;
    if (operation.result) return operation.result;
    const current = epoch;
    const isCurrent = () => epoch === current && users.user?.uid === uid;
    operation.busy = true;
    operation.failed = false;
    const send = useResearchPreview();
    try {
      const result = await useTourRequestStore().run(id, () => {
        if (!isCurrent()) throw new Error("The signed-in account changed");
        return send(id, operation.body, operation.key);
      });
      if (!isCurrent()) return null;
      // Only a separate, owner-scoped preview is a successful mutation.
      if (
        typeof result?.id !== "string" ||
        !result.id.trim() ||
        result.id === id ||
        result.research_preview?.source_tour_id !== id ||
        result.research_preview.unverified !== true ||
        (operation.body.generation_id !== null &&
          result.research_preview.source_generation_id !==
            operation.body.generation_id)
      )
        throw new Error("The research draft response could not be confirmed");
      operation.result = result;
      return result;
    } catch (error) {
      if (!isCurrent()) return null;
      operation.failed = true;
      throw error;
    } finally {
      if (isCurrent()) operation.busy = false;
    }
  }
  async function open(
    id: string,
    generationId: string | null,
    navigate: (result: ICreatedTour) => Promise<void>,
  ) {
    const uid = users.user?.uid;
    if (!uid) throw new Error("Sign in before trying a draft");
    if (forTour(id)?.busy || forTour(id)?.opening) return null;
    if (!forTour(id)?.result && useResearchLifecycleStore().forTour(id))
      return null;
    const current = epoch;
    const pending = start(id, generationId);
    const operation = forTour(id)!;
    const isCurrent = () =>
      epoch === current && users.user?.uid === uid && forTour(id) === operation;
    operation.opening = true;
    operation.navigationFailed = false;
    try {
      const result = await pending;
      if (!result || !isCurrent()) return null;
      await navigate(result);
      return isCurrent() ? result : null;
    } catch (error) {
      if (!isCurrent()) return null;
      if (operation.result) operation.navigationFailed = true;
      throw error;
    } finally {
      if (isCurrent()) operation.opening = false;
    }
  }
  async function openNew(
    id: string,
    generationId: string,
    navigate: (result: ICreatedTour) => Promise<void>,
  ) {
    const previous = forTour(id);
    if (
      previous?.busy ||
      previous?.opening ||
      useResearchLifecycleStore().forTour(id)
    )
      return null;
    // Only an explicitly confirmed, completed snapshot may be replaced locally.
    // An uncertain request always keeps its original body and operation key.
    if (
      previous?.result &&
      previous.result.research_preview?.source_generation_id !== generationId
    )
      delete operations.value[id];
    return open(id, generationId, navigate);
  }
  return { forTour, start, open, openNew };
});
