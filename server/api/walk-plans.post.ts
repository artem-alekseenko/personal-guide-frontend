import { readBody } from "h3";
import {
  ensureAuthHeaderOnPrivateApi,
  forwardAuthAndFetch,
  serviceEndpoint,
} from "../utils/http";
export default defineEventHandler(async (event) => {
  ensureAuthHeaderOnPrivateApi(event);
  return forwardAuthAndFetch(
    event,
    serviceEndpoint("PG_API_LIST_TOURS_URL", "/tours/", "walk-plans"),
    {
      method: "POST",
      body: await readBody(event),
      retry: 0,
      headers: { "X-Tour-Contract-Version": "3" },
    },
  );
});
