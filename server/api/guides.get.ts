import type { IGuide } from "~/types";
import { serviceEndpoint } from "../utils/http";
import { readListPages } from "../utils/listPages";
export default defineEventHandler(async (event) => {
  return readListPages<IGuide>(
    event,
    serviceEndpoint("PG_API_GUIDES_URL", "/guides/"),
    "guides",
  );
});
