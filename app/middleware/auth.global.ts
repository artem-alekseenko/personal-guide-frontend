import { getAuth } from "firebase/auth";
import { resolveAuthRedirect } from "~/utils/navigation";

const LOGIN_ROUTE = "/";

export default defineNuxtRouteMiddleware(async (to) => {
  if (import.meta.server) return;

  // public pages can be marked with meta.public = true
  const isPublic = to.meta.public === true;

  // Early return for public pages (except login page) - no need to check Firebase
  if (to.path !== LOGIN_ROUTE && isPublic) return;

  // Wait for Firebase to restore persisted auth before deciding access.
  const auth = getAuth();
  await auth.authStateReady();
  const user = auth.currentUser;

  // If we're on "/" (login page):
  if (to.path === LOGIN_ROUTE) {
    if (user) {
      // Respect ?next=/some/path if present, but allow only same-origin internal paths
      const target = resolveAuthRedirect(to.query.next);

      // Don't redirect to the same page to avoid unnecessary navigation
      if (to.path !== target) {
        return navigateTo(target, { replace: true });
      }
    }
    return; // not authorized — show login form on "/"
  }

  // For other pages: if not public and no user — send to "/" with ?next=current path
  if (!isPublic && !user) {
    return navigateTo(
      { path: LOGIN_ROUTE, query: { next: to.fullPath } },
      { replace: true },
    );
  }
});
