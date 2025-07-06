<template>
  <ModalOverlay
    :animation-type="animationType"
    :aria-describedby="descriptionId"
    :aria-labelledby="titleId"
    :close-on-overlay-click="closeOnOverlayClick"
    :open="open"
    :role="modalRole"
    @close="handleOverlayClose"
  >
    <ModalContent
      ref="modalContentRef"
      :subtitle="subtitle"
      :title="title"
      :title-id="titleId"
    >
      <!-- Main message content -->
      <div class="notification-message">
        <!-- Type indicator icon with slot support -->
        <div
          v-if="showIcon || $slots.icon"
          :class="iconClasses"
          class="notification-icon"
        >
          <slot name="icon">
            <UIcon :name="iconName" class="h-6 w-6" />
          </slot>
        </div>

        <div class="notification-text">
          <!-- Main content with slot support -->
          <slot name="content">
            <p
              :id="descriptionId"
              :aria-live="type === 'error' ? 'assertive' : 'polite'"
              aria-atomic="true"
              aria-relevant="text"
              class="notification-description"
            >
              {{ message }}
            </p>
          </slot>

          <!-- Subtitle slot -->
          <slot name="subtitle">
            <p v-if="subtitle" class="notification-subtitle">
              {{ subtitle }}
            </p>
          </slot>

          <!-- Technical details (collapsible for errors) -->
          <slot name="details">
            <div v-if="details" class="notification-details">
              <button
                v-if="type === 'error'"
                class="details-toggle"
                @click="showDetails = !showDetails"
              >
                {{ showDetails ? "Hide" : "Show" }} technical details
              </button>

              <div
                v-if="type !== 'error' || showDetails"
                class="details-content"
              >
                <pre class="details-text">{{ details }}</pre>
              </div>
            </div>
          </slot>
        </div>
      </div>

      <!-- Footer with actions -->
      <template #footer>
        <slot name="footer">
          <button
            v-if="showSecondaryAction"
            ref="secondaryButtonRef"
            :disabled="primaryButtonLoading"
            class="action-button action-button--secondary"
            @click="handleSecondaryAction"
            @keydown="handleTabKey"
          >
            {{ secondaryActionText }}
          </button>

          <button
            ref="primaryButtonRef"
            :class="primaryButtonClasses"
            :disabled="primaryButtonLoading"
            class="action-button action-button--primary"
            @click="handlePrimaryAction"
            @keydown="handleTabKey"
          >
            <span
              v-if="primaryButtonLoading"
              aria-hidden="true"
              class="button-spinner"
            ></span>
            {{ primaryActionText }}
          </button>
        </slot>
      </template>
    </ModalContent>
  </ModalOverlay>
</template>

<script lang="ts" setup>
import ModalOverlay from "~/components/base/ModalOverlay.vue";
import ModalContent from "~/components/base/ModalContent.vue";
import type {
  CloseReason,
  NotificationModalEmits,
  NotificationModalProps,
  NotificationType,
} from "~/types/modal";
import { generateModalIds } from "~/utils/id";

// Using Nuxt UI icons

type Props = NotificationModalProps;
type Emits = NotificationModalEmits;

const props = withDefaults(defineProps<Props>(), {
  primaryActionText: "OK",
  secondaryActionText: "Cancel",
  showSecondaryAction: false,
  closeOnOverlayClick: true,
  closeOnSecondaryAction: true,
  primaryButtonLoading: false,
  autoClose: false,
  autoCloseDuration: 5000,
});

const emit = defineEmits<Emits>();

// Internal state
const showDetails = ref(false);
const showIcon = computed(() => true); // Can be made configurable

// Refs for focus management
const modalContentRef = ref<InstanceType<typeof ModalContent> | null>(null);
const primaryButtonRef = ref<HTMLElement | null>(null);
const secondaryButtonRef = ref<HTMLElement | null>(null);

// Generate stable unique IDs for accessibility (one time generation)
const { titleId, descriptionId } = generateModalIds();

// Type-based styling and icons
const iconName = computed(() => {
  const iconMap = {
    success: "i-heroicons-check-circle",
    warning: "i-heroicons-exclamation-triangle",
    info: "i-heroicons-information-circle",
    error: "i-heroicons-x-circle",
  };
  return iconMap[props.type];
});

// Dynamic role based on notification type
const modalRole = computed(() => {
  // Error and warning notifications require immediate attention
  return props.type === "error" || props.type === "warning"
    ? "alertdialog"
    : "dialog";
});

// Dynamic animation type based on notification type
const animationType = computed(() => {
  const animationMap: Record<
    NotificationType,
    "default" | "bounce" | "slide" | "zoom"
  > = {
    success: "bounce",
    error: "slide",
    warning: "zoom",
    info: "default",
  };
  return animationMap[props.type];
});

const iconClasses = computed(() => ({
  "notification-icon--success": props.type === "success",
  "notification-icon--warning": props.type === "warning",
  "notification-icon--info": props.type === "info",
  "notification-icon--error": props.type === "error",
}));

const primaryButtonClasses = computed(() => ({
  "action-button--danger": props.type === "error",
  "action-button--success": props.type === "success",
  "action-button--warning": props.type === "warning",
  "action-button--info": props.type === "info",
}));

// Event handlers
const closeModal = (reason: CloseReason) => {
  emit("update:open", false);
  emit("close", reason);
};

const handleOverlayClose = (reason: "overlay" | "escape") => {
  closeModal(reason);
};

const handlePrimaryAction = () => {
  emit("primary-action");
  closeModal("primary-action");
};

const handleSecondaryAction = () => {
  emit("secondary-action");
  if (props.closeOnSecondaryAction) {
    closeModal("secondary-action");
  }
};

// Focus trap - handle Tab key to keep focus within modal
const handleTabKey = (event: KeyboardEvent) => {
  if (event.key !== "Tab") return;

  const focusableElements = [
    secondaryButtonRef.value,
    primaryButtonRef.value,
  ].filter(Boolean) as HTMLElement[];

  if (focusableElements.length === 0) return;

  const firstElement = focusableElements[0];
  const lastElement = focusableElements[focusableElements.length - 1];

  if (event.shiftKey) {
    // Shift + Tab (backward)
    if (document.activeElement === firstElement && lastElement) {
      event.preventDefault();
      lastElement.focus();
    }
  } else {
    // Tab (forward)
    if (document.activeElement === lastElement && firstElement) {
      event.preventDefault();
      firstElement.focus();
    }
  }
};

// Auto-close timer
let autoCloseTimer: NodeJS.Timeout | null = null;

const startAutoCloseTimer = () => {
  if (props.autoClose && (props.type === "success" || props.type === "info")) {
    autoCloseTimer = setTimeout(() => {
      closeModal("primary-action");
    }, props.autoCloseDuration);
  }
};

const clearAutoCloseTimer = () => {
  if (autoCloseTimer) {
    clearTimeout(autoCloseTimer);
    autoCloseTimer = null;
  }
};

// Auto-close details when modal closes
watch(
  () => props.open,
  (newValue) => {
    if (!newValue) {
      showDetails.value = false;
      clearAutoCloseTimer();
    } else {
      // Focus primary button after next tick to ensure DOM is updated
      nextTick(() => {
        if (primaryButtonRef.value) {
          primaryButtonRef.value.focus();
        }
      });

      // Start auto-close timer for success/info notifications
      startAutoCloseTimer();
    }
  },
);

// Clear timer when component unmounts
onUnmounted(() => {
  clearAutoCloseTimer();
});
</script>

<style scoped>
/* Notification message layout */
.notification-message {
  display: flex;
  gap: 0.75rem;
}

.notification-text {
  flex: 1;
}

.notification-description {
  color: hsl(217, 19%, 27%);
}

.dark .notification-description {
  color: hsl(216, 12%, 84%);
}

.notification-subtitle {
  font-size: 0.875rem;
  color: hsl(220, 9%, 46%);
  margin-top: 0.5rem;
}

.dark .notification-subtitle {
  color: hsl(218, 11%, 65%);
}

/* Icon styling */
.notification-icon {
  flex-shrink: 0;
  display: flex;
  align-items: flex-start;
}

.notification-icon--success {
  color: hsl(142, 71%, 45%);
}

.notification-icon--warning {
  color: hsl(45, 93%, 47%);
}

.notification-icon--info {
  color: hsl(217, 91%, 60%);
}

.notification-icon--error {
  color: hsl(0, 84%, 60%);
}

/* Details section */
.notification-details {
  margin-top: 1rem;
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
}

.details-toggle {
  font-size: 0.875rem;
  color: hsl(220, 9%, 46%);
  text-decoration: underline;
  background: none;
  border: none;
  cursor: pointer;
  text-align: left;
}

.details-toggle:hover {
  color: hsl(217, 19%, 27%);
}

.dark .details-toggle {
  color: hsl(218, 11%, 65%);
}

.dark .details-toggle:hover {
  color: hsl(220, 13%, 91%);
}

.details-content {
  border-radius: 0.375rem;
  background-color: hsl(210, 20%, 98%);
  padding: 0.75rem;
  border: 1px solid hsl(220, 13%, 91%);
}

.dark .details-content {
  background-color: hsl(215, 28%, 17%);
  border-color: hsl(215, 14%, 34%);
}

.details-text {
  font-size: 0.75rem;
  color: hsl(215, 14%, 34%);
  white-space: pre-wrap;
  font-family:
    ui-monospace, SFMono-Regular, "SF Mono", Consolas, "Liberation Mono", Menlo,
    monospace;
  line-break: anywhere;
}

.dark .details-text {
  color: hsl(218, 11%, 65%);
}

/* Action buttons */
.action-button {
  padding: 0.5rem 1rem;
  font-size: 0.875rem;
  font-weight: 500;
  border-radius: 0.375rem;
  transition: all 0.2s;
  border: none;
  cursor: pointer;
}

.action-button:focus {
  outline: none;
  box-shadow: 0 0 0 2px hsla(217, 91%, 60%, 0.5);
}

.action-button--secondary {
  color: hsl(217, 19%, 27%);
  background-color: hsl(220, 14%, 96%);
}

.action-button--secondary:hover {
  background-color: hsl(220, 13%, 91%);
}

.dark .action-button--secondary {
  background-color: hsl(217, 19%, 27%);
  color: hsl(216, 12%, 84%);
}

.dark .action-button--secondary:hover {
  background-color: hsl(215, 14%, 34%);
}

.action-button--primary {
  color: white;
  background-color: hsl(221, 83%, 53%);
}

.action-button--primary:hover {
  background-color: hsl(224, 76%, 48%);
}

.action-button--danger {
  background-color: hsl(0, 72%, 51%);
}

.action-button--danger:hover {
  background-color: hsl(0, 74%, 42%);
}

.action-button--success {
  background-color: hsl(142, 76%, 36%);
}

.action-button--success:hover {
  background-color: hsl(142, 72%, 29%);
}

.action-button--warning {
  background-color: hsl(41, 96%, 40%);
}

.action-button--warning:hover {
  background-color: hsl(35, 92%, 33%);
}

.action-button--info {
  background-color: hsl(221, 83%, 53%);
}

.action-button--info:hover {
  background-color: hsl(224, 76%, 48%);
}

/* Loading spinner */
.button-spinner {
  display: inline-block;
  width: 0.875rem;
  height: 0.875rem;
  margin-right: 0.5rem;
  border: 2px solid transparent;
  border-top: 2px solid currentColor;
  border-radius: 50%;
  animation: spin 1s linear infinite;
}

@keyframes spin {
  to {
    transform: rotate(360deg);
  }
}

/* Disabled button styles */
.action-button:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}

.action-button:disabled:hover {
  background-color: inherit;
}
</style>
