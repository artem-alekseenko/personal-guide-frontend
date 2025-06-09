export default defineNuxtRouteMiddleware(async (to) => {
  console.log(`🔒 Auth middleware: checking access to ${to.path}`);

  // Use auth composable for better compatibility
  const { isAuthenticated } = useAuth();
  
  // If not authenticated, wait a bit for Firebase Auth to initialize
  if (!isAuthenticated.value) {
    console.log("🔒 User not immediately authenticated, waiting for Firebase Auth initialization...");
    
    let attempts = 0;
    const maxAttempts = 30; // 30 * 100ms = 3 seconds
    
    while (!isAuthenticated.value && attempts < maxAttempts) {
      await new Promise(resolve => setTimeout(resolve, 100));
      attempts++;
    }
    
    console.log(`🔒 Auth check completed after ${attempts * 100}ms, authenticated: ${isAuthenticated.value}`);
  }

  // If still not authenticated after waiting, redirect to home
  if (!isAuthenticated.value) {
    console.warn(`🔒 Access denied to ${to.path} - redirecting to home`);
    return navigateTo("/");
  }

  console.log(`🔒 Access granted to ${to.path}`);
});
