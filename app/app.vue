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
          :close-on-overlay-click="notification.closeOnOverlayClick"
          :details="notification.details"
          :message="notification.message"
          :open="notification.open"
          :primary-action-text="notification.primaryActionText"
          :secondary-action-text="notification.secondaryActionText"
          :show-secondary-action="notification.showSecondaryAction"
          :subtitle="notification.subtitle"
          :title="notification.title"
          :type="notification.type"
          @close="handleModalClose"
          @update:open="handleOpenChange"
          @primary-action="handlePrimaryAction"
          @secondary-action="handleSecondaryAction"
        />
      </div>
    </div>
  </UApp>
</template>

<script setup>
const { notification, handlePrimaryAction, handleSecondaryAction, hideNotification } = useNotification();

const handleOpenChange = (isOpen) => {
  if (!isOpen) {
    hideNotification();
  }
};

const handleModalClose = (reason) => {
  if (notification.value.onClose) {
    notification.value.onClose(reason);
  }
  
  hideNotification();
};
</script>
