export default defineNuxtRouteMiddleware((to, from) => {
  if (
    import.meta.client &&
    to.name === "settings" &&
    from.name &&
    from.name !== "settings"
  ) {
    sessionStorage.setItem("settingsReturnRoute", from.path);
  }
});
