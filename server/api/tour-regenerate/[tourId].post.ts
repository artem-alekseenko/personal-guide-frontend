import type { ICreatedTour } from "../../../app/types";
import type { GenerationSummary } from "../../../shared/types/researchLifecycle";
import { forwardAuthAndFetch } from "../../utils/http";
import { researchEndpoint } from "../../utils/researchLifecycle";

export default defineEventHandler((event) =>
  forwardAuthAndFetch<{
    tour: ICreatedTour;
    result: "SUCCESS" | "FAILURE";
    generation: GenerationSummary;
  }>(event, researchEndpoint(event, "regenerate"), {
    method: "POST",
    retry: 0,
  }),
);
