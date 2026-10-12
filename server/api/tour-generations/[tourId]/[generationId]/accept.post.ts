import type { ICreatedTour } from "../../../../../app/types";
import { forwardAuthAndFetch } from "../../../../utils/http";
import { researchEndpoint } from "../../../../utils/researchLifecycle";

export default defineEventHandler((event) =>
  forwardAuthAndFetch<ICreatedTour>(
    event,
    researchEndpoint(event, "accept", true),
    { method: "POST", retry: 0 },
  ),
);
