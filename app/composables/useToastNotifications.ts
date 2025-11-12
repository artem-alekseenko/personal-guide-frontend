import type { ToastProps } from '@nuxt/ui';

export const useToastNotifications = () => {
  const toast = useToast();
  const { t } = useI18n();

  const showSuccess = (title: string, description?: string) => {
    toast.add({
      title,
      description,
      color: 'success',
      icon: 'i-lucide-check-circle',
    } as ToastProps);
  };

  const showError = (title: string, description?: string) => {
    toast.add({
      title,
      description,
      color: 'error',
      icon: 'i-lucide-alert-circle',
    } as ToastProps);
  };

  const showWarning = (title: string, description?: string) => {
    toast.add({
      title,
      description,
      color: 'warning',
      icon: 'i-lucide-alert-triangle',
    } as ToastProps);
  };

  const showInfo = (title: string, description?: string) => {
    toast.add({
      title,
      description,
      color: 'info',
      icon: 'i-lucide-info',
    } as ToastProps);
  };

  const showSettingsSaved = () => {
    showSuccess(
      t('toast.settings.saved'),
      t('toast.settings.savedDescription')
    );
  };

  const showSettingsError = (error?: string) => {
    showError(
      t('toast.settings.error'),
      error || t('toast.settings.errorDescription')
    );
  };

  const showNetworkError = () => {
    showError(
      t('toast.network.error'),
      t('toast.network.errorDescription')
    );
  };

  const showApiError = (error: any, context?: string) => {
    const title = context ? `${context} failed` : t('toast.general.operationFailed');
    const description = error?.message || t('toast.general.unexpectedError');
    
    showError(title, description);
  };

  return {
    toast,
    showSuccess,
    showError,
    showWarning,
    showInfo,
    showSettingsSaved,
    showSettingsError,
    showNetworkError,
    showApiError,
  };
}; 