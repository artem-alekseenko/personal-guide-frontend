import type { ResearchFile } from "../../../shared/types/researchLifecycle";
import { forwardAuthAndFetch } from "../../utils/http";
import { researchEndpoint } from "../../utils/researchLifecycle";

export default defineEventHandler((event) =>
  forwardAuthAndFetch<{ files: ResearchFile[] }>(
    event,
    researchEndpoint(event, "research"),
  ),
);
