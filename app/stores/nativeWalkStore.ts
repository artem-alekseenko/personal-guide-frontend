import { defineStore } from "pinia";
import { computed, shallowRef } from "vue";
import { NativeWalkController } from "~/utils/nativeWalkController";
import type {
  WalkAction,
  WalkRequest,
  WalkView,
} from "#shared/types/nativeWalk";
import { useUserStore } from "./userStore";

export const useNativeWalkStore = defineStore("nativeWalk", () => {
  const view = shallowRef<WalkView | null>(null);
  const pending = shallowRef<WalkRequest | null>(null);
  const busy = shallowRef(false);
  let epoch = 0;
  let activeRequests = 0;
  let controller: NativeWalkController | null = null;
  let scope = "";
  let mountingOwner: symbol | null = null;
  const users = useUserStore();
  const uncertain = computed(() => pending.value !== null && !busy.value);
  function attach(tourId: string) {
    if (mountingOwner)
      throw new Error("A walking controller is already mounted");
    const token = Symbol("native-walk-controller");
    const uid = users.user?.uid;
    if (!uid) throw new Error("Sign in before opening a walk");
    mountingOwner = token;
    const version = ++epoch;
    scope = `${uid}:${tourId}`;
    view.value = null;
    pending.value = null;
    const { $apiFetch } = useNuxtApp();
    const api = $apiFetch as typeof $fetch;
    const url = `/api/native-walk/${encodeURIComponent(tourId)}`;
    const current = () =>
      epoch === version && users.user?.uid === uid && mountingOwner === token;
    const update = () => {
      if (!current() || !controller) return;
      view.value = controller.view;
      pending.value = controller.pending;
    };
    controller = new NativeWalkController(
      {
        read: () => api<WalkView>(url),
        write: (body) =>
          api<WalkView>(url, {
            method: "POST",
            body,
            retry: 0,
            headers: {
              "Idempotency-Key": body.operation_id,
              "X-Tour-Contract-Version": "3",
            },
          }),
      },
      current,
      update,
    );
    return () => {
      if (mountingOwner !== token) return;
      epoch++;
      mountingOwner = null;
      controller = null;
      scope = "";
      view.value = null;
      pending.value = null;
      busy.value = false;
      activeRequests = 0;
    };
  }
  async function perform<T>(
    operation: (active: NativeWalkController) => Promise<T>,
  ) {
    const active = controller;
    const version = epoch;
    if (!active) throw new Error("No active walking controller");
    activeRequests++;
    busy.value = true;
    try {
      return await operation(active);
    } finally {
      if (version === epoch) {
        activeRequests--;
        busy.value = activeRequests > 0;
      }
    }
  }
  return {
    view,
    pending,
    busy,
    uncertain,
    attach,
    isScope: (tourId: string) => scope === `${users.user?.uid}:${tourId}`,
    load: (reconcile = false) => perform((active) => active.load(reconcile)),
    send: (action: WalkAction, fields?: Partial<WalkRequest>) =>
      perform((active) => active.send(action, fields)),
    retry: () => perform((active) => active.retry()),
  };
});
