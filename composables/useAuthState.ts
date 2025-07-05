import { useAuth } from "~/composables/useAuth";

export const useAuthState = () => {
  const { isAuthenticated, isLoading } = useAuth();
  
  // Track if Firebase auth has been initialized
  const isAuthInitialized = ref(false);
  
  // Show loader when:
  // 1. Auth is not initialized yet, OR
  // 2. User is not authenticated and we're still loading, OR
  // 3. We're explicitly loading something
  const shouldShowAuthLoader = computed(() => {
    return !isAuthInitialized.value || (!isAuthenticated.value && isLoading.value) || isLoading.value;
  });
  
  // Mark auth as initialized when user state changes
  watch(isAuthenticated, (newValue) => {
    if (newValue) {
      // Add a small delay when user becomes authenticated to show completion
      setTimeout(() => {
        isAuthInitialized.value = true;
      }, 500);
    } else {
      isAuthInitialized.value = true;
    }
  }, { immediate: true });
  
  // Also mark as initialized after a reasonable timeout
  onMounted(() => {
    setTimeout(() => {
      isAuthInitialized.value = true;
    }, 5000); // 5 second timeout
  });
  
  return {
    shouldShowAuthLoader,
    isAuthInitialized,
    isAuthenticated,
    isLoading
  };
}; 