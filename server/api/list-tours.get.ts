import type { ICreatedTour } from "~/types";
import { serviceEndpoint } from "../utils/http";
import { readListPages } from "../utils/listPages";
export default defineEventHandler(async (event) => {
  return readListPages<ICreatedTour>(
    event,
    serviceEndpoint("PG_API_LIST_TOURS_URL", "/tours/"),
    "tours",
  );
});
