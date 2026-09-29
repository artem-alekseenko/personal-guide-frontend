import { getAuth } from "firebase/auth";
import { useLogger } from "@/composables/utils/useLogger";

export default defineNuxtPlugin(() => {
  const logger = useLogger();
  let pendingToken: { uid: string; promise: Promise<string> } | null = null;

  const apiFetch = $fetch.create({
    onRequest: async ({ request, options }) => {
      const url = new URL(
        typeof request === "string"
          ? request
          : request instanceof URL
            ? request.href
            : request.url,
        location.origin,
      );
      if (url.origin !== location.origin || !url.pathname.startsWith("/api/"))
        return;

      let user: any = null;
      try {
        const auth = getAuth();
        user = auth.currentUser;
      } catch {
        return;
      }
      if (!user) return;

      try {
        if (!pendingToken || pendingToken.uid !== user.uid) {
          const pending = {
            uid: user.uid,
            promise: user.getIdToken() as Promise<string>,
          };
          pendingToken = pending;
          void pending.promise
            .finally(() => {
              if (pendingToken === pending) pendingToken = null;
            })
            .catch(() => {});
        }
        const tokenValue = await pendingToken.promise;
        if (getAuth().currentUser?.uid !== user.uid)
          throw new Error("Authentication changed during request");

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

        options.credentials = "include";
      } catch (error) {
        logger.warn("apiFetch: no token available");
        throw error;
      }
    },
  });

  return { provide: { apiFetch } };
});
