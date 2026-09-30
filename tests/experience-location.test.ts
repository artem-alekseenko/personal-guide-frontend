import { expect, it, vi } from "vitest";
import { effectScope, nextTick, ref } from "vue";
import { useExperienceLocation } from "../app/composables/tour/useExperienceLocation";
it("clears location after disabling GPS during an in-flight update without resending identical fixes", async () => {
  const enabled = ref(true),
    blocked = ref(false),
    ready = ref(true);
  const fix = ref({
    point: { lat: "47", lng: "19" },
    accuracy: 5,
    recorded_at: new Date().toISOString(),
  });
  let complete!: (ok: boolean) => void;
  const sent: unknown[] = [];
  const send = vi.fn(async (body: unknown) => {
    sent.push(body);
    return new Promise<boolean>((r) => {
      complete = r;
    });
  });
  const scope = effectScope();
  const location = scope.run(() =>
    useExperienceLocation({ enabled, blocked, ready, fix, send }),
  )!;
  await nextTick();
  expect(sent).toHaveLength(1);
  enabled.value = false;
  await nextTick();
  expect(sent).toHaveLength(1);
  complete(true);
  await vi.waitFor(() => expect(sent).toHaveLength(2));
  expect(sent[1]).toEqual({ action: "LOCATION_UPDATE" });
  complete(true);
  await nextTick();
  await location.sync();
  expect(sent).toHaveLength(2);
  scope.stop();
});
it("withholds updates while another request is busy and clears an expired fix", async () => {
  const blocked = ref(true);
  const fix = ref({
    point: { lat: "47", lng: "19" },
    accuracy: 5,
    recorded_at: new Date().toISOString(),
  });
  const sent: unknown[] = [];
  const scope = effectScope();
  const location = scope.run(() =>
    useExperienceLocation({
      enabled: ref(true),
      blocked,
      ready: ref(true),
      fix,
      send: async (b) => {
        sent.push(b);
        return true;
      },
    }),
  )!;
  await nextTick();
  expect(sent).toEqual([]);
  blocked.value = false;
  await nextTick();
  await nextTick();
  expect(sent).toHaveLength(1);
  fix.value = {
    ...fix.value,
    recorded_at: new Date(Date.now() - 100000).toISOString(),
  };
  await nextTick();
  await nextTick();
  expect(sent[1]).toEqual({ action: "LOCATION_UPDATE" });
  scope.stop();
});
it("does not loop on a rejected fix when there is no pending server operation", async () => {
  let calls = 0;
  const scope = effectScope();
  const location = scope.run(() =>
    useExperienceLocation({
      enabled: ref(true),
      blocked: ref(false),
      ready: ref(true),
      fix: ref({
        point: { lat: "47", lng: "19" },
        accuracy: 5,
        recorded_at: new Date().toISOString(),
      }),
      send: async () => {
        calls++;
        if (calls > 1) return new Promise<boolean>(() => {});
        return false;
      },
    }),
  )!;
  await nextTick();
  void location.sync();
  await nextTick();
  expect(calls).toBe(1);
  scope.stop();
});
