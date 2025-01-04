import { getCurrentUser } from "vuefire";

export default defineNuxtRouteMiddleware(async () => {
  const user = getCurrentUser();

  if (!user) {
    return navigateTo("/");
  }
});
