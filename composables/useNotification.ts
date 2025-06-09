import type { NotificationType } from '~/types/modal';

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
const notificationState = ref<NotificationState>({
  open: false,
  type: 'info',
  title: '',
  message: '',
  primaryActionText: 'OK',
  secondaryActionText: 'Cancel',
  showSecondaryAction: false,
  closeOnOverlayClick: true,
  closeOnSecondaryAction: true,
  primaryButtonLoading: false,
  autoClose: false,
  autoCloseDuration: 5000,
});

export const useNotification = () => {
  const showNotification = (type: NotificationType, options: NotificationOptions) => {
    notificationState.value = {
      open: true,
      type,
      title: options.title || 'Notification',
      subtitle: options.subtitle,
      message: options.message || 'Notification message',
      details: options.details,
      primaryActionText: options.primaryActionText || 'OK',
      secondaryActionText: options.secondaryActionText || 'Cancel',
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

  const hideNotification = () => {
    notificationState.value.open = false;
  };

  const handlePrimaryAction = () => {
    if (notificationState.value.onPrimaryAction) {
      notificationState.value.onPrimaryAction();
    }
    hideNotification();
  };

  const handleSecondaryAction = () => {
    if (notificationState.value.onSecondaryAction) {
      notificationState.value.onSecondaryAction();
    }
    hideNotification();
  };

  // Convenience methods for different notification types
  const showError = (options: NotificationOptions) => {
    const defaults = {
      title: 'Error',
      message: 'Sorry, an error occurred. Please try again later.',
      primaryActionText: 'OK',
    };
    
    showNotification('error', {
      ...defaults,
      ...options,
    });
  };

  const showSuccess = (options: NotificationOptions) => {
    const defaults = {
      title: 'Success',
      message: 'Operation completed successfully.',
      primaryActionText: 'Great!',
      autoClose: true,
      autoCloseDuration: 4000,
    };
    
    showNotification('success', {
      ...defaults,
      ...options,
    });
  };

  const showWarning = (options: NotificationOptions) => {
    const defaults = {
      title: 'Warning',
      message: 'Please review and proceed with caution.',
      primaryActionText: 'Understood',
    };
    
    showNotification('warning', {
      ...defaults,
      ...options,
    });
  };

  const showInfo = (options: NotificationOptions) => {
    const defaults = {
      title: 'Information',
      message: 'Here is some information for you.',
      primaryActionText: 'OK',
      autoClose: true,
      autoCloseDuration: 6000,
    };
    
    showNotification('info', {
      ...defaults,
      ...options,
    });
  };

  // Convenience method for API errors
  const showApiError = (error: any, context?: string) => {
    const title = 'Error';
    const subtitle = context ? `Context: ${context}` : undefined;
    
    // Default fallback message
    let message = 'Sorry, an error occurred. Please try again later.';
    let details = '';

    try {
      if (error?.response) {
        // HTTP error response
        const status = error.response.status;
        const statusText = error.response.statusText;
        
        if (status && statusText) {
          message = `Server error (${status}): ${statusText}`;
        }
        
        if (error.response.data) {
          try {
            details = JSON.stringify(error.response.data, null, 2);
          } catch (e) {
            details = String(error.response.data);
          }
        }
      } else if (error?.message) {
        // General error with message
        message = error.message || message;
        details = error.stack || '';
      } else if (typeof error === 'string') {
        // String error
        message = error || message;
      }
    } catch (e) {
      console.error('Error parsing error object:', e);
      // Keep default message if parsing fails
    }

    showError({
      title,
      subtitle,
      message,
      details: details || undefined,
      primaryActionText: 'OK',
      onPrimaryAction: () => {
        // Just close the modal
      }
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