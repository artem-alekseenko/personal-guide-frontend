import type { GenerationDetail } from "../../../../../shared/types/researchLifecycle";
import { forwardAuthAndFetch } from "../../../../utils/http";
import { researchEndpoint } from "../../../../utils/researchLifecycle";

export default defineEventHandler((event) =>
  forwardAuthAndFetch<GenerationDetail>(
    event,
    researchEndpoint(event, "finish-early", true),
    { method: "POST", retry: 0 },
  ),
);
