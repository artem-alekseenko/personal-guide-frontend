<template>
  <teleport to="body">
    <transition name="modal-fade" appear>
      <div
        v-if="open"
        ref="overlayRef"
        :aria-describedby="ariaDescribedby"
        :aria-labelledby="ariaLabelledby"
        :role="role"
        aria-modal="true"
        class="modal-overlay"
        tabindex="-1"
        @click="handleOverlayClick"
        @keydown="handleKeydown"
      >
        <!-- Backdrop -->
        <div aria-hidden="true" class="modal-backdrop" />

        <!-- Modal content slot with content transition -->
        <transition :name="`modal-${animationType}`" appear>
          <div
            v-if="open"
            class="modal-container"
            @click.stop
          >
            <slot />
          </div>
        </transition>
      </div>
    </transition>
  </teleport>
</template>

<script lang="ts" setup>
import type { ModalOverlayEmits, ModalOverlayProps } from "~/types/modal";

type Props = ModalOverlayProps;
type Emits = ModalOverlayEmits;

const props = withDefaults(defineProps<Props>(), {
  closeOnOverlayClick: true,
  closeOnEscape: true,
  role: "dialog",
  animationType: "default",
});

const emit = defineEmits<Emits>();

const overlayRef = ref<HTMLElement | null>(null);

const handleOverlayClick = () => {
  if (props.closeOnOverlayClick) {
    emit("close", "overlay");
  }
};

const handleKeydown = (event: KeyboardEvent) => {
  if (event.key === "Escape" && props.closeOnEscape) {
    event.preventDefault();
    event.stopPropagation();
    emit("close", "escape");
  }
};

// Focus management
watch(
  () => props.open,
  (newValue) => {
    if (newValue) {
      // Block body scroll when modal opens
      document.body.style.overflow = "hidden";

      // Focus overlay after next tick to ensure DOM is updated
      nextTick(() => {
        if (overlayRef.value) {
          overlayRef.value.focus();
        }
      });
    } else {
      // Restore body scroll
      document.body.style.overflow = "";
    }
  },
);

// Cleanup on unmount
onUnmounted(() => {
  document.body.style.overflow = "";
});
</script>

<style scoped>
.modal-overlay {
  position: fixed;
  top: 0;
  right: 0;
  bottom: 0;
  left: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 9999;
}

.modal-backdrop {
  position: absolute;
  top: 0;
  right: 0;
  bottom: 0;
  left: 0;
  background-color: hsla(0, 0%, 0%, 0.5);
}

.modal-container {
  position: relative;
  z-index: 10;
  margin: 0 1rem;
  width: 100%;
  max-width: 28rem;
  max-height: 90vh;
  overflow-y: auto;
}

/* Enhanced transition animations */

/* Modal fade (backdrop) transitions */
.modal-fade-enter-active,
.modal-fade-leave-active {
  transition: opacity 0.25s cubic-bezier(0.4, 0, 0.2, 1);
}

.modal-fade-enter-from,
.modal-fade-leave-to {
  opacity: 0;
}

/* Modal content transitions - Default */
.modal-default-enter-active {
  transition: all 0.3s cubic-bezier(0.34, 1.56, 0.64, 1);
}

.modal-default-leave-active {
  transition: all 0.2s cubic-bezier(0.4, 0, 1, 1);
}

.modal-default-enter-from {
  opacity: 0;
  transform: scale(0.9) translateY(-20px);
}

.modal-default-leave-to {
  opacity: 0;
  transform: scale(0.95) translateY(-10px);
}

/* Modal content transitions - Bounce */
.modal-bounce-enter-active {
  transition: all 0.4s cubic-bezier(0.68, -0.55, 0.265, 1.55);
}

.modal-bounce-leave-active {
  transition: all 0.25s cubic-bezier(0.4, 0, 1, 1);
}

.modal-bounce-enter-from {
  opacity: 0;
  transform: scale(0.7) translateY(-30px);
}

.modal-bounce-leave-to {
  opacity: 0;
  transform: scale(0.9) translateY(-15px);
}

/* Modal content transitions - Slide */
.modal-slide-enter-active {
  transition: all 0.3s cubic-bezier(0.25, 0.46, 0.45, 0.94);
}

.modal-slide-leave-active {
  transition: all 0.2s cubic-bezier(0.55, 0.085, 0.68, 0.53);
}

.modal-slide-enter-from {
  opacity: 0;
  transform: translateY(-50px);
}

.modal-slide-leave-to {
  opacity: 0;
  transform: translateY(30px);
}

/* Modal content transitions - Zoom */
.modal-zoom-enter-active {
  transition: all 0.25s cubic-bezier(0.25, 0.46, 0.45, 0.94);
}

.modal-zoom-leave-active {
  transition: all 0.2s cubic-bezier(0.55, 0.085, 0.68, 0.53);
}

.modal-zoom-enter-from {
  opacity: 0;
  transform: scale(0.8);
}

.modal-zoom-leave-to {
  opacity: 0;
  transform: scale(1.1);
}

/* Smooth backdrop fade */
.modal-backdrop {
  transition: background-color 0.25s ease;
}

.modal-fade-enter-from .modal-backdrop,
.modal-fade-leave-to .modal-backdrop {
  background-color: hsla(0, 0%, 0%, 0);
}
</style>
