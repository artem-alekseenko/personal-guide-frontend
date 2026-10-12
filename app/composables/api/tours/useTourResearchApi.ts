import type { ICreatedTour } from "~/types";
import type {
  GenerationDetail,
  GenerationSummary,
  ResearchEnrichment,
  ResearchFile,
} from "#shared/types/researchLifecycle";
import type { PreparationMessageRequest } from "#shared/types/preparationProgress";

const statuses: Record<string, true> = {
  PENDING: true,
  RUNNING: true,
  READY: true,
  FAILED: true,
  CANCELLED: true,
};
const isString = (value: unknown): value is string =>
  typeof value === "string" && value.trim().length > 0;

export function confirmResearchGeneration(
  value: GenerationSummary,
  tourId: string,
  generationId?: string,
): GenerationSummary {
  if (
    !value ||
    !isString(value.generation_id) ||
    value.tour_id !== tourId ||
    !isString(value.owner_id) ||
    statuses[value.status] !== true ||
    !isString(value.stage) ||
    !Number.isInteger(value.sequence) ||
    value.sequence < 1 ||
    !isString(value.created_at) ||
    !isString(value.updated_at) ||
    (generationId !== undefined && value.generation_id !== generationId)
  )
    throw new Error("The generation response could not be confirmed");
  return value;
}

export function confirmResearchTour(value: ICreatedTour, tourId: string) {
  if (
    !value ||
    value.id !== tourId ||
    !isString(value.user_id) ||
    !isString(value.status)
  )
    throw new Error("The source tour response could not be confirmed");
  return value;
}

export function useTourResearchApi() {
  const api = () => useNuxtApp().$apiFetch as typeof $fetch;
  const path = (tourId: string) =>
    `/api/tour-generations/${encodeURIComponent(tourId)}`;
  const identity = (key: string) => ({ "Idempotency-Key": key });

  async function source(tourId: string) {
    return confirmResearchTour(
      await api()<ICreatedTour>(`/api/get-tour/${encodeURIComponent(tourId)}`),
      tourId,
    );
  }
  async function history(
    tourId: string,
    shouldContinue: () => boolean = () => true,
  ): Promise<GenerationSummary[]> {
    const result: GenerationSummary[] = [];
    const seen = new Set<string>();
    const limit = 100;
    // Same bounded complete-list policy as the existing tour/guide pagination.
    for (let page = 0; page < 100; page++) {
      if (!shouldContinue())
        throw new Error("The research history scope changed");
      const response = await api()<{ generations: GenerationSummary[] }>(
        path(tourId),
        {
          query: { skip: page * limit, limit },
        },
      );
      if (!shouldContinue())
        throw new Error("The research history scope changed");
      if (
        !Array.isArray(response?.generations) ||
        response.generations.length > limit
      )
        throw new Error(
          "The generation history response could not be confirmed",
        );
      for (const entry of response.generations) {
        confirmResearchGeneration(entry, tourId);
        if (seen.has(entry.generation_id))
          throw new Error("Generation history pagination did not advance");
        seen.add(entry.generation_id);
        result.push(entry);
      }
      if (response.generations.length < limit) return result;
    }
    throw new Error("Generation history pagination limit exceeded");
  }
  async function detail(
    tourId: string,
    generationId: string,
    progressQuery?: { lang: "en" | "ru"; message_variant: number },
  ) {
    const response = await api()<GenerationDetail>(
      `${path(tourId)}/${encodeURIComponent(generationId)}`,
      { query: progressQuery, retry: 0 },
    );
    confirmResearchGeneration(response?.generation, tourId, generationId);
    if (response.progress && response.progress.generation_id !== generationId)
      throw new Error("The preparation progress belongs to another generation");
    return response;
  }
  async function progressMessage(
    tourId: string,
    generationId: string,
    key: string,
    body: Readonly<PreparationMessageRequest>,
  ) {
    const response = await api()<GenerationDetail>(
      `${path(tourId)}/${encodeURIComponent(generationId)}/progress-message`,
      { method: "POST", headers: identity(key), body, retry: 0 },
    );
    confirmResearchGeneration(response?.generation, tourId, generationId);
    if (
      !response.progress ||
      response.progress.generation_id !== generationId ||
      !["llm", "fallback", "recorded"].includes(
        response.progress.activity_source ?? "",
      )
    )
      throw new Error("The progress caption response could not be confirmed");
    return response;
  }
  async function cancel(tourId: string, generationId: string, key: string) {
    const response = await api()<GenerationDetail>(
      `${path(tourId)}/${encodeURIComponent(generationId)}/cancel`,
      {
        method: "POST",
        headers: identity(key),
        retry: 0,
      },
    );
    confirmResearchGeneration(response?.generation, tourId, generationId);
    if (response.generation.status !== "CANCELLED")
      throw new Error("Generation cancellation could not be confirmed");
    return response;
  }
  async function finishEarly(
    tourId: string,
    generationId: string,
    key: string,
  ) {
    const response = await api()<GenerationDetail>(
      `${path(tourId)}/${encodeURIComponent(generationId)}/finish-early`,
      {
        method: "POST",
        headers: identity(key),
        retry: 0,
      },
    );
    confirmResearchGeneration(response?.generation, tourId, generationId);
    if (response.generation.finish_early_requested !== true)
      throw new Error(
        "Continuing with completed research could not be confirmed",
      );
    return response;
  }
  async function accept(tourId: string, generationId: string, key: string) {
    return confirmResearchTour(
      await api()<ICreatedTour>(
        `${path(tourId)}/${encodeURIComponent(generationId)}/accept`,
        {
          method: "POST",
          headers: identity(key),
          retry: 0,
        },
      ),
      tourId,
    );
  }
  async function regenerate(tourId: string, key: string) {
    const response = await api()<{
      tour: ICreatedTour;
      result: "SUCCESS" | "FAILURE";
      generation: GenerationSummary;
    }>(`/api/tour-regenerate/${encodeURIComponent(tourId)}`, {
      method: "POST",
      headers: identity(key),
      retry: 0,
    });
    confirmResearchTour(response?.tour, tourId);
    confirmResearchGeneration(response?.generation, tourId);
    if (
      response.result !== "SUCCESS" ||
      response.generation.idempotency_key !== key
    )
      throw new Error("The new generation operation could not be confirmed");
    return response;
  }
  async function research(tourId: string) {
    const response = await api()<{ files: ResearchFile[] }>(
      `/api/tour-research/${encodeURIComponent(tourId)}`,
    );
    if (
      !Array.isArray(response?.files) ||
      response.files.some(
        (file) =>
          !file ||
          !isString(file.artifact_id) ||
          !isString(file.generation_id) ||
          !isString(file.kind) ||
          !isString(file.content_type) ||
          !isString(file.created_at) ||
          typeof file.url !== "string" ||
          !Number.isInteger(file.byte_size) ||
          file.byte_size < 0,
      )
    )
      throw new Error("The saved research index could not be confirmed");
    return response.files;
  }
  async function enrichment(tourId: string) {
    const response = await api()<ResearchEnrichment>(
      `/api/tour-enrichment/${encodeURIComponent(tourId)}`,
    );
    if (
      !response ||
      !["not_requested", "queued", "running", "completed", "failed"].includes(
        response.status,
      ) ||
      !Number.isInteger(response.rounds) ||
      response.rounds < 0 ||
      !Array.isArray(response.items)
    )
      throw new Error("The enrichment response could not be confirmed");
    return response;
  }
  const download = (tourId: string, artifactId: string) =>
    api()<Blob>(
      `/api/research-artifacts/${encodeURIComponent(tourId)}/${encodeURIComponent(artifactId)}`,
      {
        responseType: "blob",
        retry: 0,
      },
    );
  return {
    source,
    history,
    detail,
    progressMessage,
    cancel,
    finishEarly,
    accept,
    regenerate,
    research,
    enrichment,
    download,
  };
}
