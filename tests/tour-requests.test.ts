import { expect, it } from "vitest";
import { useTourRequestStore } from "../app/stores/tourRequestStore";
it("serializes mutations for the same tour and releases failed requests", async () => {
  const requests = useTourRequestStore();
  const events: string[] = [];
  let release!: () => void;
  const first = requests.run("tour", async () => {
    events.push("first");
    await new Promise<void>((r) => {
      release = r;
    });
    throw new Error("Offline");
  });
  const failed = expect(first).rejects.toThrow("Offline");
  const second = requests.run("tour", async () => {
    events.push("second");
    return 2;
  });
  await Promise.resolve();
  expect(events).toEqual(["first"]);
  expect(requests.isBusy("tour")).toBe(true);
  release();
  await failed;
  expect(await second).toBe(2);
  expect(events).toEqual(["first", "second"]);
  expect(requests.isBusy("tour")).toBe(false);
});
it("does not block another tour or execute queued work after reset", async () => {
  const requests = useTourRequestStore();
  let release!: () => void;
  const first = requests.run(
    "tour",
    () =>
      new Promise<void>((r) => {
        release = r;
      }),
  );
  let executed = false;
  const queued = requests.run("tour", async () => {
    executed = true;
  });
  const cancelled = expect(queued).rejects.toThrow();
  expect(await requests.run("other", async () => 3)).toBe(3);
  requests.reset();
  release();
  await first;
  await cancelled;
  expect(executed).toBe(false);
});
