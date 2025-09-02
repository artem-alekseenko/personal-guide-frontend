import { getAuth } from "firebase/auth";
import { useLogger } from "@/composables/useLogger";

export default defineNuxtPlugin(() => {
  const logger = useLogger();
  // Create a custom $fetch instance that includes Firebase ID token in Authorization header
  // Note: This plugin is named with 01- to load after Firebase (00-) and before client code that might use $apiFetch.

  // Micro-cache for parallel requests to avoid multiple getIdToken() calls
  let pendingToken: Promise<string> | null = null;

  const apiFetch = $fetch.create({
    onRequest: async ({ request, options }) => {
      // allow string | URL | Request
      const isApiPath =
        (typeof request === "string" && request.startsWith("/api/")) ||
        (request instanceof URL && request.pathname.startsWith("/api/")) ||
        // @ts-ignore: Request may not be in lib.dom types in some tsconfigs
        (typeof Request !== "undefined" &&
          request instanceof Request &&
          new URL(request.url).pathname.startsWith("/api/"));

      if (!isApiPath) return;

      // Guard against rare early call before Firebase app is ready
      let user: any = null;
      try {
        const auth = getAuth();
        user = auth.currentUser;
      } catch {
        // Firebase App not initialized yet — skip token injection
        return;
      }
      if (!user) return;

      try {
        // Use cached token promise to avoid parallel getIdToken() calls
        const token =
          pendingToken ??
          (pendingToken = user.getIdToken().finally(() => {
            pendingToken = null;
          }));
        const tokenValue = await token;

        console.log("!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!! Token:", tokenValue);

        // normalize headers (HeadersInit)
        const h = options.headers;
        if (!h) {
          options.headers = new Headers([
            ["Authorization", `Bearer ${tokenValue}`],
          ]);
        } else if (h instanceof Headers) {
          h.set("Authorization", `Bearer ${tokenValue}`);
        } else if (Array.isArray(h)) {
          // Convert array format to Headers instance
          const headers = new Headers(h);
          headers.set("Authorization", `Bearer ${tokenValue}`);
          options.headers = headers;
        } else {
          (options.headers as any).Authorization = `Bearer ${tokenValue}`;
        }

        // Check same-origin before setting credentials to avoid sending cookies to different domains
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
        // Silent catch - if token retrieval fails (race conditions, user logged out), proceed without it
        logger.warn("apiFetch: no token available");
      }
    },
  });

  return { provide: { apiFetch } };
});

// Type augmentation
declare module "#app" {
  interface NuxtApp {
    $apiFetch: typeof $fetch;
  }
}
declare module "vue" {
  interface ComponentCustomProperties {
    $apiFetch: typeof $fetch;
  }
}
