import { createError, getQuery } from "h3";
import type { GenerationDetail } from "../../../../shared/types/researchLifecycle";
import { forwardAuthAndFetch } from "../../../utils/http";
import { researchEndpoint } from "../../../utils/researchLifecycle";

export default defineEventHandler((event) => {
  const endpoint = researchEndpoint(event, "", true);
  const query = getQuery(event);
  const variant = query.message_variant;
  if (
    variant !== undefined &&
    (typeof variant !== "string" ||
      !/^\d+$/.test(variant) ||
      !Number.isSafeInteger(Number(variant)) ||
      Number(variant) > 2_147_483_647)
  )
    throw createError({
      statusCode: 400,
      statusMessage: "Invalid progress message variant",
    });
  if (query.lang !== undefined && query.lang !== "en" && query.lang !== "ru")
    throw createError({
      statusCode: 400,
      statusMessage: "Invalid progress language",
    });
  return forwardAuthAndFetch<GenerationDetail>(event, endpoint, {
    query: {
      ...(variant === undefined ? {} : { message_variant: Number(variant) }),
      ...(query.lang === undefined ? {} : { lang: query.lang }),
    },
    retry: 0,
  });
});
