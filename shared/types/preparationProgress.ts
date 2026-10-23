export type PreparationCompletionReason =
  "completed" | "budget_wrap_up" | "incomplete_wrap_up";

export interface PreparationCounters {
  turns_started: number;
  turns_completed: number;
  tool_calls_completed: number;
  sources_count: number;
  source_bytes: number;
  claims_count: number;
  word_count: number;
  archive_bytes: number;
}

export interface PreparationStopProgress extends PreparationCounters {
  stop_id: string;
  name: string;
  status:
    "QUEUED" | "RUNNING" | "COMPLETED" | "FAILED" | "CANCELLED" | "SKIPPED";
  phase: string;
  attempt: number;
  progress_percent?: number;
  completion_reason?: PreparationCompletionReason | null;
  step_name?: string;
  step_description?: string;
  updated_at: string | null;
}

/** Owner-scoped research ledger amounts are USD micros. */
export interface PreparationResearchSpend {
  limit_micros: number;
  spent_micros: number;
  reserved_micros: number;
  remaining_micros: number;
}

export interface PreparationMessageRequest {
  lang: "en" | "ru";
  message_variant: number;
  /** Novelty hint only, never client-supplied evidence. */
  previous_activity_text?: string;
}

export interface PreparationProgress extends PreparationCounters {
  generation_id: string;
  status: "PENDING" | "RUNNING" | "READY" | "FAILED" | "CANCELLED";
  phase: string;
  /** Server environment switch; factual research progress continues when disabled. */
  rich_progress_enabled?: boolean;
  /** Backend stage-weighted estimate, not elapsed-time completion. */
  percent?: number;
  step_percent?: number;
  step_name?: string;
  step_description?: string;
  is_loading?: boolean;
  partial_result?: boolean;
  completion_reason?: PreparationCompletionReason | null;
  status_text?: string;
  elapsed_seconds?: number;
  remaining_seconds?: number | null;
  remaining_time_kind?: "estimate" | "deadline" | "unknown" | "complete";
  activity_text?: string;
  activity_updated_at?: string | null;
  activity_stale?: boolean;
  activity_source?: "llm" | "fallback" | "recorded";
  activity_model?: string | null;
  activity_fallback_reason?: string | null;
  activity_generated_at?: string | null;
  research_spend?: PreparationResearchSpend | null;
  active_researchers: number;
  completed_stops: number;
  skipped_stops?: number;
  total_stops: number;
  error: string | null;
  updated_at: string;
  stops: PreparationStopProgress[];
}
