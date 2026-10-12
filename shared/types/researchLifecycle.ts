import type { PreparationProgress } from "./preparationProgress";

export interface GenerationSummary {
  generation_id: string;
  tour_id: string;
  owner_id: string;
  status: "PENDING" | "RUNNING" | "READY" | "FAILED" | "CANCELLED";
  stage: string;
  sequence: number;
  created_at: string;
  updated_at: string;
  error_code?: string | null;
  error_summary?: string | null;
  experimental_preview?: boolean;
  idempotency_key?: string;
  finish_early_requested?: boolean;
}

export interface GenerationDetail {
  generation: GenerationSummary;
  progress?: PreparationProgress | null;
}

export interface ResearchFile {
  artifact_id: string;
  generation_id: string;
  kind: string;
  content_type: string;
  byte_size: number;
  created_at: string;
  url: string;
}

export interface ResearchEnrichment {
  status: "not_requested" | "queued" | "running" | "completed" | "failed";
  reason: string | null;
  rounds: number;
  updated_at: string | null;
  error: string | null;
  items: unknown[];
}

export type ResearchActionKind =
  "cancel" | "regenerate" | "accept" | "finish-early";

export interface ResearchPendingAction {
  readonly kind: ResearchActionKind;
  readonly generationId: string | null;
  readonly key: string;
  busy: boolean;
  failed: boolean;
}
