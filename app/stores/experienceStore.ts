import { defineStore } from "pinia";
import { computed, ref } from "vue";
import type { Experience, Interaction } from "~/types/tourExperience";
type Operation = {
  key: string;
  body: Interaction & {
    expected_revision: number;
    generation_id: string | null;
  };
};
export const useExperienceStore = defineStore("experience", () => {
  const view = ref<Experience | null>(null),
    busy = ref(false),
    hasPending = ref(false);
  let tourId = "",
    ownerId = "",
    epoch = 0,
    readVersion = 0,
    operation: Operation | null = null;
  const api = () => useNuxtApp().$apiFetch as typeof $fetch;
  const reset = () => {
    epoch++;
    readVersion++;
    tourId = "";
    ownerId = "";
    view.value = null;
    busy.value = false;
    operation = null;
    hasPending.value = false;
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
    )
      view.value = result;
  };
  const send = async () => {
    if (!operation || busy.value)
      throw new Error("An action is already in progress");
    const current = epoch,
      pending = operation;
    busy.value = true;
    try {
      const result = await api()<Experience>(
        `/api/tour-interactions/${encodeURIComponent(tourId)}`,
        {
          method: "POST",
          body: pending.body,
          headers: { "Idempotency-Key": pending.key },
          retry: 0,
        },
      );
      if (current === epoch) {
        readVersion++;
        view.value = result;
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
    if (operation || busy.value)
      throw new Error("Retry the previous action first");
    if (!view.value) throw new Error("Load the current stop first");
    operation = {
      key: crypto.randomUUID(),
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
    operation = null;
    hasPending.value = false;
    await load(tourId, ownerId);
  };
  return {
    view,
    busy,
    hasPending,
    load,
    act,
    retry: send,
    refresh,
    reset,
    ready: computed(() => !!view.value),
  };
});
