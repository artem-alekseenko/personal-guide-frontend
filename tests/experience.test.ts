import { expect, it, vi } from "vitest";
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
