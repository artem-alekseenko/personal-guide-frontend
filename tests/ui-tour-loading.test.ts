import { expect, it, vi } from "vitest";
import { useTourLoader } from "../app/composables/tour/useTourLoader";

it("shows loading until the requested tour is available", async () => {
  let resolve!: () => void;
  let ready = false;
  const fetch = vi.fn(
    () =>
      new Promise<void>((done) => {
        resolve = done;
      }),
  );
  const loader = useTourLoader(fetch, () => ready);
  const pending = loader.load();
  expect(loader.loading.value).toBe(true);
  ready = true;
  resolve();
  await pending;
  expect(loader.loading.value).toBe(false);
  expect(loader.failed.value).toBe(false);
});

it("shows a retryable failure for missing data and recovers on retry", async () => {
  let ready = false;
  const loader = useTourLoader(
    vi.fn(async () => {}),
    () => ready,
  );
  await loader.load();
  expect(loader.failed.value).toBe(true);
  ready = true;
  await loader.load();
  expect(loader.failed.value).toBe(false);
});

it("contains fetch errors without leaving the loading indicator active", async () => {
  const loader = useTourLoader(
    async () => {
      throw new Error("offline");
    },
    () => false,
  );
  await loader.load();
  expect(loader.loading.value).toBe(false);
  expect(loader.failed.value).toBe(true);
});

it("ignores late results after disposal and coalesces repeated requests", async () => {
  let resolve!: () => void;
  const fetch = vi.fn(
    () =>
      new Promise<void>((done) => {
        resolve = done;
      }),
  );
  const loader = useTourLoader(fetch, () => true);
  const first = loader.load();
  const second = loader.load();
  expect(fetch).toHaveBeenCalledTimes(1);
  loader.dispose();
  resolve();
  await Promise.all([first, second]);
  expect(loader.loading.value).toBe(true);
  await loader.load();
  expect(fetch).toHaveBeenCalledTimes(1);
});
