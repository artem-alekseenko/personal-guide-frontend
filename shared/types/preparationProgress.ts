export interface PreparationCounters {
  turns_started: number;
  turns_completed: number;
  tool_calls_completed: number;
  sources_count: number;
  source_bytes: number;
  claims_count: number;
  word_count: number;
  archive_bytes: number;
  updated_at: string;
}

export interface PreparationStopProgress extends PreparationCounters {
  stop_id: string;
  name: string;
  status: "QUEUED" | "RUNNING" | "COMPLETED" | "FAILED" | "CANCELLED";
  phase:
    | "QUEUED"
    | "THINKING"
    | "SEARCHING"
    | "FETCHING"
    | "SUBMITTING"
    | "COMPLETED"
    | "FAILED"
    | "CANCELLED";
  attempt: number;
}

export interface PreparationProgress extends PreparationCounters {
  generation_id: string;
  status: "PENDING" | "RUNNING" | "READY" | "FAILED" | "CANCELLED";
  phase:
    | "CAPTURE"
    | "ROUTE"
    | "RESEARCH"
    | "COMPOSITION"
    | "REVIEW"
    | "PUBLICATION";
  active_researchers: number;
  completed_stops: number;
  total_stops: number;
  error: string | null;
  stops: PreparationStopProgress[];
}
