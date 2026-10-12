import { getQuery } from "h3";
import type { GenerationSummary } from "../../../../shared/types/researchLifecycle";
import { forwardAuthAndFetch } from "../../../utils/http";
import { researchEndpoint } from "../../../utils/researchLifecycle";

export default defineEventHandler((event) => {
  const query = getQuery(event);
  return forwardAuthAndFetch<{ generations: GenerationSummary[] }>(
    event,
    researchEndpoint(event, "generations"),
    { query: { skip: query.skip ?? 0, limit: query.limit ?? 100 } },
  );
});
