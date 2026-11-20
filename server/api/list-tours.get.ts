import { createError, getQuery } from "h3";
import type { ICreatedTour } from "~/types";
import { serviceEndpoint } from "../utils/http";
import { readListPage, readListPages } from "../utils/listPages";
export default defineEventHandler(async (event) => {
  const query = getQuery(event);
  const endpoint = serviceEndpoint("PG_API_LIST_TOURS_URL", "/tours/");
  if (query.skip === undefined && query.limit === undefined)
    return readListPages<ICreatedTour>(event, endpoint, "tours");
  const skip = numericQuery(query.skip ?? "0");
  const limit = numericQuery(query.limit ?? "10");
  if (
    !Number.isSafeInteger(skip) ||
    !Number.isSafeInteger(limit) ||
    limit < 1 ||
    limit > 100
  )
    throw createError({
      statusCode: 400,
      statusMessage: "Invalid tour pagination",
    });
  return readListPage<ICreatedTour>(event, endpoint, "tours", skip, limit);
});

function numericQuery(value: unknown) {
  return typeof value === "string" && /^\d+$/.test(value) ? Number(value) : NaN;
}
