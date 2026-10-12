import type { ResearchEnrichment } from "../../../shared/types/researchLifecycle";
import { forwardAuthAndFetch } from "../../utils/http";
import { researchEndpoint } from "../../utils/researchLifecycle";

export default defineEventHandler((event) =>
  forwardAuthAndFetch<ResearchEnrichment>(
    event,
    researchEndpoint(event, "enrichment"),
  ),
);
