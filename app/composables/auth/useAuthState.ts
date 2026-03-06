import { useAuth } from "~/composables/auth/useAuth";

export const useAuthState = () => {
  const { isAuthenticated, isLoading } = useAuth();

  const isAuthInitialized = ref(false);

  const shouldShowAuthLoader = computed(() => {
    return (
      !isAuthInitialized.value || (!isAuthenticated.value && isLoading.value)
    );
  });

  watch(
    isAuthenticated,
    (newValue) => {
      if (newValue) {
        setTimeout(() => {
          isAuthInitialized.value = true;
        }, 500);
      } else {
        isAuthInitialized.value = true;
      }
    },
    { immediate: true },
  );

  onMounted(() => {
    setTimeout(() => {
      isAuthInitialized.value = true;
    }, 5000);
  });

  return {
    shouldShowAuthLoader,
    isAuthInitialized,
    isAuthenticated,
    isLoading,
  };
};
