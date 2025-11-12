import { getAuth, type User } from "firebase/auth";
import { getCurrentUser } from "vuefire";

const LOGIN_ROUTE = "/";
const AFTER_LOGIN_ROUTE = "/tours";

export default defineNuxtRouteMiddleware(async (to) => {
  if (import.meta.server) return;

  // public pages can be marked with meta.public = true
  const isPublic = to.meta.public === true;

  // Early return for public pages (except login page) - no need to check Firebase
  if (to.path !== LOGIN_ROUTE && isPublic) return;

  // Fast path: try currentUser first, then await Firebase init if needed
  const auth = getAuth();
  let user: User | null = auth.currentUser;
  if (!user) {
    user = (await getCurrentUser().catch(() => null)) || null;
  }

  // If we're on "/" (login page):
  if (to.path === LOGIN_ROUTE) {
    if (user) {
      // Respect ?next=/some/path if present, but allow only same-origin internal paths
      const nextParam =
        typeof to.query.next === "string" ? to.query.next : undefined;
      const target =
        nextParam && nextParam.startsWith("/") ? nextParam : AFTER_LOGIN_ROUTE;
      
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
