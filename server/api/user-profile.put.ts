import { useExternalApi } from "~/composables/server/useExternalApi";
import { serviceEndpoint } from "../utils/http";
import type { IServerUserResponse } from "~/types";
export default defineEventHandler(async (event) => {
  const body = await readBody(event);
  if (
    !body ||
    typeof body.name !== "string" ||
    !body.name.trim() ||
    !["en", "ru"].includes(body.language)
  ) {
    throw createError({
      statusCode: 400,
      statusMessage: "A name and supported language are required",
    });
  }
  return useExternalApi<IServerUserResponse>(
    event,
    serviceEndpoint("PG_API_UPDATE_ME", "/users/me/"),
    {
      name: body.name.trim(),
      language: body.language,
      ...(Object.hasOwn(body, "personal_context")
        ? { personal_context: body.personal_context }
        : {}),
    },
    "PUT",
  );
});
