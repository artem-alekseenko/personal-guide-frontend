import { getCurrentInstance } from "vue";
import type { NotificationType } from "~/types/modal";

interface NotificationOptions {
  title?: string;
  subtitle?: string;
  message?: string;
  details?: string;
  primaryActionText?: string;
  secondaryActionText?: string;
  showSecondaryAction?: boolean;
  closeOnOverlayClick?: boolean;
  closeOnSecondaryAction?: boolean;
  primaryButtonLoading?: boolean;
  autoClose?: boolean;
  autoCloseDuration?: number;
  onPrimaryAction?: () => void;
  onSecondaryAction?: () => void;
  onClose?: (reason: string) => void;
}

interface NotificationState {
  id: number;
  open: boolean;
  type: NotificationType;
  title: string;
  subtitle?: string;
  message: string;
  details?: string;
  primaryActionText: string;
  secondaryActionText: string;
  showSecondaryAction: boolean;
  closeOnOverlayClick: boolean;
  closeOnSecondaryAction: boolean;
  primaryButtonLoading: boolean;
  autoClose: boolean;
  autoCloseDuration: number;
  onPrimaryAction?: () => void;
  onSecondaryAction?: () => void;
  onClose?: (reason: string) => void;
}

// Global notification state
let notificationId = 0;
const notificationState = ref<NotificationState>({
  id: notificationId,
  open: false,
  type: "info",
  title: "",
  message: "",
  primaryActionText: "",
  secondaryActionText: "",
  showSecondaryAction: false,
  closeOnOverlayClick: true,
  closeOnSecondaryAction: true,
  primaryButtonLoading: false,
  autoClose: false,
  autoCloseDuration: 5000,
});

type NotificationTranslator = (
  key: string,
  values?: Record<string, unknown>,
) => string;
let translateNotification: NotificationTranslator = (key) => key;

export const useNotification = () => {
  // Capture the app's composer in setup; notifications also run in async catches.
  if (getCurrentInstance()) translateNotification = useI18n().t;
  const t: NotificationTranslator = (key, values) =>
    translateNotification(key, values);
  const showNotification = (
    type: NotificationType,
    options: NotificationOptions,
  ) => {
    notificationState.value = {
      id: ++notificationId,
      open: true,
      type,
      title: options.title || t("notifications.title"),
      subtitle: options.subtitle,
      message: options.message || t("notifications.message"),
      details: options.details,
      primaryActionText: options.primaryActionText || t("notifications.ok"),
      secondaryActionText:
        options.secondaryActionText || t("notifications.cancel"),
      showSecondaryAction: options.showSecondaryAction || false,
      closeOnOverlayClick: options.closeOnOverlayClick ?? true,
      closeOnSecondaryAction: options.closeOnSecondaryAction ?? true,
      primaryButtonLoading: options.primaryButtonLoading ?? false,
      autoClose: options.autoClose ?? false,
      autoCloseDuration: options.autoCloseDuration ?? 5000,
      onPrimaryAction: options.onPrimaryAction,
      onSecondaryAction: options.onSecondaryAction,
      onClose: options.onClose,
    };
  };

  const hideNotification = (reason?: string) => {
    const current = notificationState.value;
    current.open = false;
    if (reason) current.onClose?.(reason);
  };

  const handlePrimaryAction = () => {
    const current = notificationState.value;
    current.onPrimaryAction?.();
    if (notificationState.value === current) hideNotification("primary-action");
  };

  const handleSecondaryAction = () => {
    const current = notificationState.value;
    current.onSecondaryAction?.();
    if (notificationState.value === current && current.closeOnSecondaryAction) {
      hideNotification("secondary-action");
    }
  };

  // Convenience methods for different notification types
  const showError = (options: NotificationOptions) => {
    const defaults = {
      title: t("notifications.errorTitle"),
      message: t("notifications.errorMessage"),
      primaryActionText: t("notifications.ok"),
    };

    showNotification("error", {
      ...defaults,
      ...options,
    });
  };

  const showSuccess = (options: NotificationOptions) => {
    const defaults = {
      title: t("notifications.successTitle"),
      message: t("notifications.successMessage"),
      primaryActionText: t("notifications.great"),
      autoClose: true,
      autoCloseDuration: 4000,
    };

    showNotification("success", {
      ...defaults,
      ...options,
    });
  };

  const showWarning = (options: NotificationOptions) => {
    const defaults = {
      title: t("notifications.warningTitle"),
      message: t("notifications.warningMessage"),
      primaryActionText: t("notifications.understood"),
    };

    showNotification("warning", {
      ...defaults,
      ...options,
    });
  };

  const showInfo = (options: NotificationOptions) => {
    const defaults = {
      title: t("notifications.infoTitle"),
      message: t("notifications.infoMessage"),
      primaryActionText: t("notifications.ok"),
      autoClose: true,
      autoCloseDuration: 6000,
    };

    showNotification("info", {
      ...defaults,
      ...options,
    });
  };

  // Diagnostics deliberately exclude response bodies, messages and stacks.
  const showApiError = (error: unknown, context?: string) => {
    const value = error as {
      statusCode?: number;
      status?: number;
      response?: { status?: number; headers?: Headers };
    } | null;
    const status =
      value?.response?.status ?? value?.statusCode ?? value?.status;
    const requestId = value?.response?.headers?.get?.("x-request-id");
    const details = [
      Number.isInteger(status)
        ? t("notifications.status", { status })
        : undefined,
      requestId && /^[a-zA-Z0-9._:-]{1,128}$/.test(requestId)
        ? t("notifications.requestId", { requestId })
        : undefined,
    ]
      .filter(Boolean)
      .join("\n");
    const contextKeys: Record<string, string> = {
      "Tour request failed": "contextTourRequest",
      "Could not pause the tour": "contextPauseTour",
      "Failed to fetch tour data": "contextFetchTour",
      "Audio playback failed": "contextAudioPlayback",
      "Could not plan the route": "contextPlanRoute",
      "Could not create the tour": "contextCreateTour",
    };
    const localizedContext =
      context && contextKeys[context]
        ? t(`notifications.${contextKeys[context]}`)
        : undefined;
    showError({
      subtitle: localizedContext
        ? t("notifications.context", { context: localizedContext })
        : undefined,
      details: details || undefined,
    });
  };

  return {
    // State
    notification: readonly(notificationState),

    // Actions
    showNotification,
    hideNotification,
    handlePrimaryAction,
    handleSecondaryAction,

    // Convenience methods
    showError,
    showSuccess,
    showWarning,
    showInfo,
    showApiError,
  };
};
