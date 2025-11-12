export type NotificationType = 'error' | 'success' | 'warning' | 'info';

export type CloseReason = 'overlay' | 'escape' | 'primary-action' | 'secondary-action';

export interface NotificationModalProps {
  open: boolean;
  type: NotificationType;
  title: string;
  subtitle?: string;
  message: string;
  details?: string;
  primaryActionText?: string;
  secondaryActionText?: string;
  showSecondaryAction?: boolean;
  closeOnOverlayClick?: boolean;
  closeOnSecondaryAction?: boolean;
  primaryButtonLoading?: boolean;
  autoClose?: boolean;
  autoCloseDuration?: number;
}

export interface NotificationModalEmits {
  (e: 'update:open', value: boolean): void;
  (e: 'close', reason: CloseReason): void;
  (e: 'primary-action'): void;
  (e: 'secondary-action'): void;
}

export interface ModalOverlayEmits {
  (e: 'close', reason: 'overlay' | 'escape'): void;
}

export interface ModalOverlayProps {
  open: boolean;
  closeOnOverlayClick?: boolean;
  closeOnEscape?: boolean;
  ariaLabelledby?: string;
  ariaDescribedby?: string;
  role?: 'dialog' | 'alertdialog';
  animationType?: 'default' | 'bounce' | 'slide' | 'zoom';
}

export interface ModalContentProps {
  title?: string;
  subtitle?: string;
  titleId?: string;
} 