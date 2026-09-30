import { defineStore } from "pinia";
import { computed, ref } from "vue";
import type {
  Experience,
  ExperienceSource,
  Interaction,
} from "~/types/tourExperience";
import { useTourRequestStore } from "./tourRequestStore";
import { normalizeGuideInteractionMode } from "#shared/types/guideInteraction";
import { normalizePersonalContext } from "#shared/types/personalContext";
import { reconcileAfterCommand } from "#shared/utils/reconcileAfterCommand";
type Operation = {
  key: string;
  sent: boolean;
  body: Interaction & {
    expected_revision: number;
    generation_id: string | null;
  };
};
export const useExperienceStore = defineStore("experience", () => {
  const view = ref<Experience | null>(null),
    busy = ref(false),
    hasPending = ref(false),
    needsReconciliation = ref(false);
  let tourId = "",
    ownerId = "",
    epoch = 0,
    readVersion = 0,
    operation: Operation | null = null;
  const api = () => useNuxtApp().$apiFetch as typeof $fetch;
  const sourceCatalog = ref<Record<string, ExperienceSource>>({});
  const applyView = (result: Experience) => {
    if (view.value?.generation_id !== result.generation_id)
      sourceCatalog.value = {};
    for (const source of result.sources ?? [])
      sourceCatalog.value[source.id] = source;
    view.value = {
      ...result,
      interaction_mode: normalizeGuideInteractionMode(result.interaction_mode),
      personal_context: normalizePersonalContext(result.personal_context),
    };
  };
  const reset = () => {
    epoch++;
    readVersion++;
    tourId = "";
    ownerId = "";
    view.value = null;
    sourceCatalog.value = {};
    busy.value = false;
    operation = null;
    hasPending.value = false;
    needsReconciliation.value = false;
  };
  const load = async (id: string, owner: string) => {
    if (id !== tourId || owner !== ownerId) {
      reset();
      tourId = id;
      ownerId = owner;
    }
    const current = epoch;
    const reading = ++readVersion;
    const result = await api()<Experience>(
      `/api/tour-experience/${encodeURIComponent(id)}`,
    );
    if (
      current === epoch &&
      reading === readVersion &&
      (!view.value || result.revision >= view.value.revision)
    ) {
      applyView(result);
      needsReconciliation.value = false;
    }
  };
  const invalidate = (id: string) => {
    if (id && id === tourId) {
      readVersion++;
      needsReconciliation.value = true;
    }
  };
  // Automatic reads never discard a pending mutation or change its operation key.
  const reconcile = async (id = tourId) => {
    if (!id || id !== tourId) return;
    await load(id, ownerId);
  };
  const withCommand = <T>(id: string, task: () => Promise<T>): Promise<T> => {
    if (!id || id !== tourId) return task();
    const current = epoch;
    return reconcileAfterCommand(
      task,
      () => invalidate(id),
      async () => {
        if (current === epoch) {
          invalidate(id);
          await reconcile(id);
        }
      },
    );
  };
  const send = async () => {
    if (!operation || busy.value)
      throw new Error("An action is already in progress");
    const current = epoch,
      pending = operation,
      id = tourId,
      client = api();
    busy.value = true;
    try {
      const result = await useTourRequestStore().run(id, () => {
        if (current !== epoch) throw new Error("The active tour changed");
        if (needsReconciliation.value || !view.value)
          throw Object.assign(new Error("Reload the current stop first"), {
            statusCode: 409,
          });
        if (!pending.sent) {
          if (pending.body.generation_id !== view.value.generation_id)
            throw Object.assign(new Error("The tour generation changed"), {
              statusCode: 409,
            });
          pending.body.expected_revision = view.value.revision;
          pending.body.generation_id = view.value.generation_id;
          pending.sent = true;
        }
        return client<Experience>(
          `/api/tour-interactions/${encodeURIComponent(id)}`,
          {
            method: "POST",
            body: pending.body,
            headers: { "Idempotency-Key": pending.key },
            retry: 0,
          },
        );
      });
      if (current === epoch) {
        readVersion++;
        if (!view.value || result.revision >= view.value.revision)
          applyView(result);
        operation = null;
        hasPending.value = false;
      }
    } catch (error) {
      const status =
        (error as { statusCode?: number; status?: number }).statusCode ??
        (error as { status?: number }).status;
      if (
        current === epoch &&
        status &&
        [400, 401, 403, 404, 422].includes(status)
      ) {
        operation = null;
        hasPending.value = false;
      }
      throw error;
    } finally {
      if (current === epoch) busy.value = false;
    }
  };
  const act = async (input: Interaction) => {
    if (operation || busy.value || needsReconciliation.value)
      throw new Error("Retry the previous action first");
    if (!view.value) throw new Error("Load the current stop first");
    operation = {
      key: crypto.randomUUID(),
      sent: false,
      body: JSON.parse(
        JSON.stringify({
          ...input,
          expected_revision: view.value.revision,
          generation_id: view.value.generation_id,
        }),
      ),
    };
    hasPending.value = true;
    await send();
  };
  // Explicit refresh reconciles a stale revision. It never replays a discarded action.
  const refresh = async () => {
    if (busy.value) return;
    const current = epoch;
    busy.value = true;
    try {
      await load(tourId, ownerId);
      if (current === epoch) {
        operation = null;
        hasPending.value = false;
      }
    } finally {
      if (current === epoch) busy.value = false;
    }
  };
  return {
    view,
    viewFor: (id: string, owner: string) => {
      // Subscribe even before the scoped view loads; IDs are private metadata.
      const current = view.value;
      return id === tourId && owner === ownerId ? current : null;
    },
    busy,
    hasPending,
    needsReconciliation,
    load,
    act,
    retry: send,
    refresh,
    invalidate,
    reconcile,
    withCommand,
    reset,
    sourcesForTurn: (turn: { source_ids: string[] }) =>
      turn.source_ids
        .map((id) => sourceCatalog.value[id])
        .filter((s): s is ExperienceSource => !!s),
    ready: computed(() => !!view.value),
  };
});
