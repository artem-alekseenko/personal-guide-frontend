<template>
  <UApp :toaster="{ position: 'top-right', duration: 4000 }">
    <div class="phone-viewport">
      <div class="phone-viewport__frame">
        <!-- Auth loader -->
        <AuthLoader />

        <NuxtLayout>
          <NuxtPage />
        </NuxtLayout>

        <!-- Global notification modal -->
        <NotificationModal
          :key="notification.id"
          :auto-close="notification.autoClose"
          :auto-close-duration="notification.autoCloseDuration"
          :close-on-overlay-click="notification.closeOnOverlayClick"
          :close-on-secondary-action="notification.closeOnSecondaryAction"
          :details="notification.details"
          :message="notification.message"
          :open="notification.open"
          :primary-action-text="notification.primaryActionText"
          :primary-button-loading="notification.primaryButtonLoading"
          :secondary-action-text="notification.secondaryActionText"
          :show-secondary-action="notification.showSecondaryAction"
          :subtitle="notification.subtitle"
          :title="notification.title"
          :type="notification.type"
          @close="handleModalClose"
          @primary-action="handlePrimaryAction"
          @secondary-action="handleSecondaryAction"
        />
      </div>
    </div>
  </UApp>
</template>

<script setup>
import { useNotification } from "~/composables/ui/useNotification";

const {
  notification,
  handlePrimaryAction: performPrimaryAction,
  handleSecondaryAction: performSecondaryAction,
  hideNotification,
} = useNotification();

let actionClosePending = false;

const handlePrimaryAction = () => {
  actionClosePending = true;
  performPrimaryAction();
};

const handleSecondaryAction = () => {
  actionClosePending = notification.value.closeOnSecondaryAction;
  performSecondaryAction();
};

const handleModalClose = (reason) => {
  // An action already applies its close policy and may open a replacement.
  if (
    actionClosePending &&
    (reason === "primary-action" || reason === "secondary-action")
  ) {
    actionClosePending = false;
    return;
  }
  hideNotification(reason);
};
</script>
