import { expect, it, vi } from "vitest";
import { useTourRequestStore } from "../app/stores/tourRequestStore";
const fetchApi = vi.fn();
Object.assign(globalThis, { useNuxtApp: () => ({ $apiFetch: fetchApi }) });
async function store() {
  const path = "../app/stores/experienceStore";
  try {
    return (await import(path)).useExperienceStore();
  } catch {
    throw new Error("Text experience store must exist");
  }
}
const view = (revision = 0) => ({
  revision,
  generation_id: null,
  stop_id: "museum",
  turns: [],
  personal_context: {},
  stops: [],
  available_actions: [],
});
it("recovers an uncertain action using exactly the original payload and key", async () => {
  const s = await store();
  fetchApi.mockResolvedValueOnce(view());
  await s.load("tour", "owner");
  fetchApi.mockRejectedValueOnce(new Error("Connection lost"));
  await expect(
    s.act({ action: "ASK", text: "Why?", type_llm: "OPENAI" }),
  ).rejects.toThrow();
  const original = fetchApi.mock.calls.at(-1)![1];
  fetchApi.mockResolvedValueOnce(view(1));
  await s.retry();
  expect(fetchApi.mock.calls.at(-1)![1]).toEqual(original);
  expect(s.view.revision).toBe(1);
  expect(s.hasPending).toBe(false);
});
it("rejects new actions until an uncertain action is resolved", async () => {
  const s = await store();
  fetchApi.mockResolvedValueOnce(view());
  await s.load("tour", "owner");
  fetchApi.mockRejectedValueOnce(new Error("Lost"));
  await expect(s.act({ action: "PHOTO" })).rejects.toThrow();
  const calls = fetchApi.mock.calls.length;
  await expect(s.act({ action: "BREAK" })).rejects.toThrow();
  expect(fetchApi.mock.calls.length).toBe(calls);
});
it("cannot restore another owner's late response after reset", async () => {
  const s = await store();
  let resolve!: (v: unknown) => void;
  fetchApi.mockImplementationOnce(
    () =>
      new Promise((r) => {
        resolve = r;
      }),
  );
  const pending = s.load("tour", "owner");
  s.reset();
  resolve(view());
  await pending;
  expect(s.view).toBeNull();
});
it("drops definitive validation failures but retains uncertain errors", async () => {
  const s = await store();
  fetchApi.mockResolvedValueOnce(view());
  await s.load("tour", "owner");
  fetchApi.mockRejectedValueOnce({ statusCode: 422 });
  await expect(s.act({ action: "ASK", text: "" })).rejects.toBeDefined();
  expect(s.hasPending).toBe(false);
});
it("allows recovery by reloading a changed revision without replaying the old action", async () => {
  const s = await store();
  fetchApi.mockResolvedValueOnce(view());
  await s.load("tour", "owner");
  fetchApi.mockRejectedValueOnce({ statusCode: 409 });
  await expect(s.act({ action: "PHOTO" })).rejects.toBeDefined();
  fetchApi.mockResolvedValueOnce(view(2));
  await s.refresh();
  expect(s.hasPending).toBe(false);
  expect(s.view.revision).toBe(2);
});
it("never restores old context when a delayed read follows Forget", async () => {
  const s = await store();
  fetchApi.mockResolvedValueOnce({
    ...view(),
    personal_context: { note: "Old context" },
  });
  await s.load("tour", "owner");
  let resolve!: (v: unknown) => void;
  fetchApi.mockImplementationOnce(
    () =>
      new Promise((r) => {
        resolve = r;
      }),
  );
  const delayed = s.load("tour", "owner");
  fetchApi.mockResolvedValueOnce({
    ...view(1),
    personal_context: { note: "" },
  });
  await s.act({ action: "FORGET_CONTEXT" });
  resolve({ ...view(), personal_context: { note: "Old context" } });
  await delayed;
  expect(s.view.revision).toBe(1);
  expect(s.view.personal_context.note).toBe("");
});
it("retains the original retry when reconciliation fails", async () => {
  const s = await store();
  fetchApi.mockResolvedValueOnce(view());
  await s.load("tour", "owner");
  fetchApi.mockRejectedValueOnce(new Error("Lost response"));
  await expect(s.act({ action: "ASK", text: "Why?" })).rejects.toThrow();
  const original = fetchApi.mock.calls.at(-1)![1];
  fetchApi.mockRejectedValueOnce(new Error("Offline"));
  await expect(s.refresh()).rejects.toThrow();
  expect(s.hasPending).toBe(true);
  fetchApi.mockResolvedValueOnce(view(1));
  await s.retry();
  expect(fetchApi.mock.calls.at(-1)![1]).toEqual(original);
});
it("blocks new actions while reconciliation is in progress", async () => {
  const s = await store();
  fetchApi.mockResolvedValueOnce(view());
  await s.load("tour", "owner");
  let resolve!: (v: unknown) => void;
  fetchApi.mockImplementationOnce(
    () =>
      new Promise((r) => {
        resolve = r;
      }),
  );
  const reading = s.refresh();
  expect(s.busy).toBe(true);
  await expect(s.act({ action: "PHOTO" })).rejects.toThrow();
  resolve(view(1));
  await reading;
  expect(s.busy).toBe(false);
});
it("retains sources for earlier turns across stop changes but isolates tours", async () => {
  const s = await store();
  const source = {
    id: "museum-source",
    title: "Museum",
    url: "https://example.org",
    checked_at: "2026-09-30",
  };
  fetchApi.mockResolvedValueOnce({ ...view(), sources: [source] });
  await s.load("tour", "owner");
  fetchApi.mockResolvedValueOnce({
    ...view(1),
    stop_id: "square",
    sources: [],
  });
  await s.load("tour", "owner");
  expect(s.sourcesForTurn({ source_ids: ["museum-source"] })).toEqual([source]);
  s.reset();
  expect(s.sourcesForTurn({ source_ids: ["museum-source"] })).toEqual([]);
});
it("does not send a queued text mutation after its tour is reset", async () => {
  const s = await store();
  fetchApi.mockResolvedValueOnce(view());
  await s.load("tour", "owner");
  let release!: () => void;
  const blocking = useTourRequestStore().run(
    "tour",
    () =>
      new Promise<void>((r) => {
        release = r;
      }),
  );
  await Promise.resolve();
  const pending = s.act({ action: "PHOTO" });
  const cancelled = expect(pending).rejects.toThrow();
  s.reset();
  release();
  await blocking;
  await cancelled;
  expect(
    fetchApi.mock.calls.filter(([, options]) => options?.method === "POST"),
  ).toEqual([]);
});
