import { getAuth } from "firebase/auth";
import { useLogger } from "@/composables/utils/useLogger";

export default defineNuxtPlugin(() => {
  const logger = useLogger();
  let pendingToken: Promise<string> | null = null;

  const apiFetch = $fetch.create({
    onRequest: async ({ request, options }) => {
      const isApiPath =
        (typeof request === "string" && request.startsWith("/api/")) ||
        (request instanceof URL && request.pathname.startsWith("/api/")) ||
        // @ts-ignore: Request may not be in lib.dom types in some tsconfigs
        (typeof Request !== "undefined" &&
          request instanceof Request &&
          new URL(request.url).pathname.startsWith("/api/"));

      if (!isApiPath) return;

      let user: any = null;
      try {
        const auth = getAuth();
        user = auth.currentUser;
      } catch {
        return;
      }
      if (!user) return;

      try {
        const token =
          pendingToken ??
          (pendingToken = user.getIdToken().finally(() => {
            pendingToken = null;
          }));
        const tokenValue = await token;

        const h = options.headers;
        if (!h) {
          options.headers = new Headers([
            ["Authorization", `Bearer ${tokenValue}`],
          ]);
        } else if (h instanceof Headers) {
          h.set("Authorization", `Bearer ${tokenValue}`);
        } else if (Array.isArray(h)) {
          const headers = new Headers(h);
          headers.set("Authorization", `Bearer ${tokenValue}`);
          options.headers = headers;
        } else {
          (options.headers as any).Authorization = `Bearer ${tokenValue}`;
        }

        const origin =
          typeof request === "string"
            ? location.origin
            : request instanceof URL
              ? request.origin
              : // @ts-ignore
                new URL(request.url).origin;

        if (origin === location.origin) {
          options.credentials = "include";
        }
      } catch {
        logger.warn("apiFetch: no token available");
      }
    },
  });

  return { provide: { apiFetch } };
});
