import { createError, getRequestHeader, readBody } from "h3";
import type { GenerationDetail } from "../../../../../shared/types/researchLifecycle";
import type { PreparationMessageRequest } from "../../../../../shared/types/preparationProgress";
import { forwardAuthAndFetch } from "../../../../utils/http";
import { researchEndpoint } from "../../../../utils/researchLifecycle";

export default defineEventHandler(async (event) => {
  const endpoint = researchEndpoint(event, "progress-message", true);
  const key = getRequestHeader(event, "idempotency-key");
  const body = await readBody<PreparationMessageRequest>(event);
  if (
    !key ||
    key.length > 128 ||
    !key.trim() ||
    !body ||
    !["en", "ru"].includes(body.lang) ||
    !Number.isInteger(body.message_variant) ||
    body.message_variant < 0 ||
    body.message_variant > 2_147_483_647 ||
    (body.previous_activity_text !== undefined &&
      (typeof body.previous_activity_text !== "string" ||
        body.previous_activity_text.length > 280)) ||
    Object.keys(body).some(
      (field) =>
        !["lang", "message_variant", "previous_activity_text"].includes(field),
    )
  )
    throw createError({
      statusCode: 400,
      statusMessage: "Invalid progress caption request",
    });
  return forwardAuthAndFetch<GenerationDetail>(event, endpoint, {
    method: "POST",
    body: {
      lang: body.lang,
      message_variant: body.message_variant,
      ...(body.previous_activity_text === undefined
        ? {}
        : { previous_activity_text: body.previous_activity_text }),
    },
    retry: 0,
  });
});
