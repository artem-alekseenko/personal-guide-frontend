import type { ICreatedTour } from "~/types";

export interface ResearchPreviewRequest {
  generation_id: string | null;
}

export function useResearchPreview() {
  const api = useNuxtApp().$apiFetch as typeof $fetch;
  return (
    tourId: string,
    body: Readonly<ResearchPreviewRequest>,
    operationId: string,
  ) =>
    api<ICreatedTour>(`/api/research-preview/${encodeURIComponent(tourId)}`, {
      method: "POST",
      body,
      headers: { "Idempotency-Key": operationId },
      retry: 0,
    });
}
