import { describe, expect, it, vi } from "vitest";
import { NativeWalkController } from "../app/utils/nativeWalkController";
import type { WalkView, WalkRequest } from "../shared/types/nativeWalk";
const view = (revision = 0): WalkView => ({
  contract_version: 3,
  session_id: "session",
  generation_id: "generation",
  route_id: "route",
  route_revision: "revision",
  language: "en",
  revision,
  control_revision: 0,
  scheduling_mode: "automatic",
  paused: false,
  started: false,
  elapsed_active_seconds: 0,
  remaining_seconds: 600,
  progress: null,
  context: {
    geographic_subject_ids: [],
    discussion_subject_id: null,
    eligible_claim_ids: [],
    delivered_claim_ids: [],
  },
  eligible_action: null,
  active_delivery: null,
  offered_delivery: null,
  research_gaps: [],
  finished: false,
  completion_reason: null,
  silence_reason: null,
});

describe("native walking operation boundaries (no audio execution)", () => {
  it("loads route-only state without Start, speech or a mutation", async () => {
    const write = vi.fn();
    const controller = new NativeWalkController(
      { read: async () => view(), write },
      () => true,
    );
    await controller.load();
    expect(write).not.toHaveBeenCalled();
    expect(controller.view?.started).toBe(false);
    expect(controller.view?.context.geographic_subject_ids).toEqual([]);
  });
  it("retains the exact automatic operation key and payload after an uncertain failure", async () => {
    const write = vi
      .fn()
      .mockRejectedValueOnce({ statusCode: 502 })
      .mockResolvedValueOnce(view(1));
    const controller = new NativeWalkController(
      { read: async () => view(), write },
      () => true,
    );
    await controller.load();
    await expect(
      controller.send("ACTIVATE", {
        operation_id: "auto:eligible",
        eligible_action_id: "eligible",
      }),
    ).rejects.toEqual({ statusCode: 502 });
    const original = structuredClone(controller.pending);
    await expect(controller.send("PAUSE")).rejects.toThrow("pending");
    await controller.retry();
    expect(write).toHaveBeenCalledTimes(2);
    expect(write.mock.calls[0]![0]).toEqual(original);
    expect(write.mock.calls[1]![0]).toEqual(original);
    expect(original).toMatchObject({
      expected_generation_id: "generation",
      expected_route_revision: "revision",
      language: "en",
      operation_id: "auto:eligible",
    });
    expect(controller.pending).toBeNull();
  });
  it("drops a response when the authenticated session changed", async () => {
    const deferred = Promise.withResolvers<WalkView>();
    let current = true;
    const controller = new NativeWalkController(
      { read: async () => view(), write: () => deferred.promise },
      () => current,
    );
    await controller.load();
    const pending = controller.send("START");
    await Promise.resolve();
    current = false;
    deferred.resolve({ ...view(1), started: true });
    await expect(pending).rejects.toThrow("session changed");
    expect(controller.view?.started).toBe(false);
  });
  it("does not replace a newer paused view with an old activation receipt", async () => {
    const write = vi.fn().mockResolvedValue(view(1));
    let snapshot = view();
    const controller = new NativeWalkController(
      { read: async () => snapshot, write },
      () => true,
    );
    await controller.load();
    snapshot = { ...view(3), paused: true, control_revision: 2 };
    await controller.load();
    await controller.send("CONTINUE");
    expect(controller.view?.paused).toBe(true);
    expect(controller.view?.revision).toBe(3);
  });
  it("rejects generation replacement and preserves uncertain payload until successful reconciliation", async () => {
    let failRead = false;
    const write = vi.fn().mockRejectedValue({ statusCode: 502 });
    const controller = new NativeWalkController(
      {
        read: async () => {
          if (failRead) throw new Error("unavailable");
          return view();
        },
        write,
      },
      () => true,
    );
    await controller.load();
    await expect(controller.send("START")).rejects.toEqual({ statusCode: 502 });
    const request = controller.pending;
    failRead = true;
    await expect(controller.load(true)).rejects.toThrow("unavailable");
    expect(controller.pending).toEqual(request);
    failRead = false;
    await controller.load(true);
    expect(controller.pending).toBeNull();
    write.mockResolvedValueOnce({
      ...view(1),
      generation_id: "different-generation",
    });
    await expect(controller.send("START")).rejects.toThrow(
      "generation changed",
    );
  });
  it("serializes mutations so only one delivery path can activate at a time", async () => {
    const deferred = Promise.withResolvers<WalkView>();
    const sent: WalkRequest[] = [];
    const write = vi.fn((request: WalkRequest) => {
      sent.push(request);
      return sent.length === 1 ? deferred.promise : Promise.resolve(view(2));
    });
    const controller = new NativeWalkController(
      { read: async () => view(), write },
      () => true,
    );
    await controller.load();
    const first = controller.send("START");
    const second = controller.send("PAUSE");
    await Promise.resolve();
    expect(sent.map((request) => request.action)).toEqual(["START"]);
    deferred.resolve(view(1));
    await Promise.all([first, second]);
    expect(sent.map((request) => request.action)).toEqual(["START", "PAUSE"]);
    expect(sent[0]!.operation_id).not.toBe(sent[1]!.operation_id);
  });
});
