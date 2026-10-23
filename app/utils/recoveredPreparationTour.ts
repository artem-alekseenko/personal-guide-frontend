import type { ICreatedTour } from "~/types";

/** Refresh preparation metadata without adopting different playback or delivery state. */
export function mergeRecoveredPreparationTour(
  current: ICreatedTour | null,
  source: ICreatedTour,
): ICreatedTour | null {
  if (
    !current ||
    current.id !== source.id ||
    current.user_id !== source.user_id ||
    current.research_preview ||
    source.research_preview ||
    !(
      current.latest_generation_id ||
      current.preparation_progress?.generation_id
    ) ||
    (source.preparation_progress &&
      source.preparation_progress.generation_id !==
        (source.latest_generation_id ||
          source.preparation_progress.generation_id)) ||
    (current.latest_generation_id ||
      current.preparation_progress?.generation_id) !==
      (source.latest_generation_id ||
        source.preparation_progress?.generation_id)
  )
    return null;
  return {
    ...current,
    latest_generation_id: source.latest_generation_id,
    status: source.status,
    preparation_error: source.preparation_error,
    preparation_progress: source.preparation_progress,
    generating_percent: source.generating_percent,
    generating_string: source.generating_string,
    generated_at: source.generated_at,
  };
}
