<template>
  <UApp :toaster="{ position: 'top-right', duration: 4000 }">
    <!-- Auth loader -->
    <AuthLoader />
    
    <NuxtLayout>
      <NuxtPage />
    </NuxtLayout>
    
    <!-- Global notification modal -->
    <NotificationModal
      :open="notification.open"
      :type="notification.type"
      :title="notification.title"
      :subtitle="notification.subtitle"
      :message="notification.message"
      :details="notification.details"
      :primary-action-text="notification.primaryActionText"
      :secondary-action-text="notification.secondaryActionText"
      :show-secondary-action="notification.showSecondaryAction"
      :close-on-overlay-click="notification.closeOnOverlayClick"
      @update:open="handleOpenChange"
      @close="handleModalClose"
      @primary-action="handlePrimaryAction"
      @secondary-action="handleSecondaryAction"
    />
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
  // Call onClose callback if provided
  if (notification.value.onClose) {
    notification.value.onClose(reason);
  }
  
  hideNotification();
};
</script>
