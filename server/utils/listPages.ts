import { createError, type H3Event } from "h3";
import { useExternalApi } from "~/composables/server/useExternalApi";

/** Keep the browser's array contract while reading the backend's paginated lists. */
export async function readListPages<T extends { id: string }>(
  event: H3Event,
  endpoint: string,
  collection: string,
): Promise<T[]> {
  const limit = 100;
  const result: T[] = [];
  const seen = new Set<string>();
  // Bound a broken upstream or an unbounded catalog. Report failure rather than
  // silently returning a partial list or keeping the server occupied indefinitely.
  for (let page = 0; page < 100; page++) {
    const response = await useExternalApi<Record<string, T[]>>(
      event,
      endpoint,
      { skip: page * limit, limit },
    );
    const items = response?.[collection];
    if (
      !Array.isArray(items) ||
      items.some((item) => !item || typeof item.id !== "string")
    )
      throw createError({
        statusCode: 502,
        statusMessage: "Invalid list response",
      });
    let added = 0;
    for (const item of items) {
      if (seen.has(item.id)) continue;
      seen.add(item.id);
      result.push(item);
      added++;
    }
    if (items.length < limit) return result;
    if (!added)
      throw createError({
        statusCode: 502,
        statusMessage: "List pagination did not advance",
      });
  }
  throw createError({
    statusCode: 502,
    statusMessage: "List pagination limit exceeded",
  });
}
