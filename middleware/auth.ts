import { getCurrentUser } from "vuefire";

export default defineNuxtRouteMiddleware(async (to, from) => {
  const user = getCurrentUser();

  if (!user) {
    return navigateTo("/");
  }
});
