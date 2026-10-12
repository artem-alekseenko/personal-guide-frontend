import type { PreparationProgress } from "../../shared/types/preparationProgress";
import type { GenerationDetail, GenerationSummary } from "../../shared/types/researchLifecycle";

export function preparationSnapshot(
  patch: Partial<PreparationProgress> = {},
): PreparationProgress {
  return {
    generation_id: "generation-1",
    status: "RUNNING",
    phase: "RESEARCH",
    percent: 37,
    status_text: "Researching the stops",
    elapsed_seconds: 125,
    remaining_seconds: null,
    remaining_time_kind: "unknown",
    activity_text: "Reading a source for Clock House.",
    activity_updated_at: "2026-10-12T12:02:00Z",
    active_researchers: 2,
    completed_stops: 0,
    total_stops: 2,
    turns_started: 7,
    turns_completed: 5,
    tool_calls_completed: 9,
    sources_count: 4,
    source_bytes: 14320,
    claims_count: 0,
    word_count: 0,
    archive_bytes: 0,
    error: null,
    updated_at: "2026-10-12T12:02:00Z",
    stops: [
      {
        stop_id: "clock",
        name: "Clock House",
        status: "RUNNING",
        phase: "FETCHING",
        attempt: 1,
        turns_started: 4,
        turns_completed: 3,
        tool_calls_completed: 6,
        sources_count: 3,
        source_bytes: 11200,
        claims_count: 0,
        word_count: 0,
        archive_bytes: 0,
        updated_at: "2026-10-12T12:02:00Z",
      },
    ],
    ...patch,
  };
}

export function preparationDetail(
  snapshot = preparationSnapshot(),
  generation: Partial<GenerationSummary> = {},
): GenerationDetail {
  return {
    generation: {
      generation_id: snapshot.generation_id,
      tour_id: "tour",
      owner_id: "backend-owner",
      status: snapshot.status,
      stage: snapshot.phase,
      sequence: 1,
      created_at: "2026-10-12T12:00:00Z",
      updated_at: snapshot.updated_at,
      ...generation,
    },
    progress: snapshot,
  };
}
