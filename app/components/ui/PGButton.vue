<template>
  <button
    :class="classes"
    :disabled="disabled || loading"
    type="button"
    @click="$emit('click', $event)"
  >
    <svg
      v-if="loading"
      aria-hidden="true"
      class="pg-button__spinner"
      fill="none"
      viewBox="0 0 24 24"
      xmlns="http://www.w3.org/2000/svg"
    >
      <circle
        cx="12"
        cy="12"
        r="10"
        stroke="currentColor"
        stroke-opacity="0.25"
        stroke-width="4"
      />
      <path
        d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"
        fill="currentColor"
        fill-opacity="0.75"
      />
    </svg>
    <slot />
  </button>
</template>

<script lang="ts" setup>
const props = withDefaults(
  defineProps<{
    variant?: "solid" | "outline" | "ghost" | "soft" | "link";
    color?: "primary" | "neutral" | "error" | "success" | "warning" | "info" | "secondary";
    size?: "sm" | "md" | "lg";
    loading?: boolean;
    block?: boolean;
    disabled?: boolean;
    iconOnly?: boolean;
  }>(),
  {
    variant: "solid",
    color: "primary",
    size: "md",
  },
);

defineEmits<{ click: [event: MouseEvent] }>();

const classes = computed(() => [
  "pg-button",
  `pg-button--${props.variant}`,
  `pg-button--${props.color}`,
  `pg-button--${props.size}`,
  {
    "pg-button--block": props.block,
    "pg-button--loading": props.loading,
    "pg-button--icon-only": props.iconOnly,
  },
]);
</script>

<style scoped>
.pg-button {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 0.375rem;
  border-radius: 0.5rem;
  font-weight: 500;
  line-height: 1.25;
  white-space: nowrap;
  user-select: none;
  border: 1px solid transparent;
  cursor: pointer;
  transition:
    background-color 0.15s ease,
    border-color 0.15s ease,
    color 0.15s ease,
    opacity 0.15s ease;

  /* Color tokens – overridden per color modifier */
  --pg-btn-accent: var(--fill-green-500);
  --pg-btn-accent-hover: var(--fill-green-600);
  --pg-btn-accent-active: var(--fill-green-700);
  --pg-btn-accent-muted: var(--fill-green-50);
  --pg-btn-accent-muted-hover: var(--fill-green-100);
  --pg-btn-on-accent: oklch(1 0 0);
}

/* ─── Sizes ─── */

.pg-button--sm {
  padding-block: 0.375rem;
  padding-inline: 0.625rem;
  font-size: 0.75rem;
  border-radius: 0.375rem;
}

.pg-button--md {
  padding-block: 0.5rem;
  padding-inline: 1rem;
  font-size: 0.875rem;
}

.pg-button--lg {
  padding-block: 0.625rem;
  padding-inline: 1.25rem;
  font-size: 1rem;
}

/* Equal padding for icon-only buttons */
.pg-button--icon-only.pg-button--sm { padding-inline: 0.375rem; }
.pg-button--icon-only.pg-button--md { padding-inline: 0.5rem; }
.pg-button--icon-only.pg-button--lg { padding-inline: 0.625rem; }

.pg-button--block {
  display: flex;
  inline-size: 100%;
}

/* ─── Color tokens ─── */

.pg-button--primary {
  --pg-btn-accent: var(--fill-green-500);
  --pg-btn-accent-hover: var(--fill-green-600);
  --pg-btn-accent-active: var(--fill-green-700);
  --pg-btn-accent-muted: var(--fill-green-50);
  --pg-btn-accent-muted-hover: var(--fill-green-100);
  --pg-btn-on-accent: oklch(1 0 0);
}

.pg-button--neutral {
  --pg-btn-accent: var(--fill-gray-600);
  --pg-btn-accent-hover: var(--fill-gray-700);
  --pg-btn-accent-active: var(--fill-gray-800);
  --pg-btn-accent-muted: var(--fill-gray-100);
  --pg-btn-accent-muted-hover: var(--fill-gray-200);
  --pg-btn-on-accent: oklch(1 0 0);
}

.pg-button--error {
  --pg-btn-accent: var(--fill-red-500);
  --pg-btn-accent-hover: var(--fill-red-600);
  --pg-btn-accent-active: var(--fill-red-700);
  --pg-btn-accent-muted: var(--fill-red-50);
  --pg-btn-accent-muted-hover: var(--fill-red-100);
  --pg-btn-on-accent: oklch(1 0 0);
}

.pg-button--success {
  --pg-btn-accent: var(--fill-green-500);
  --pg-btn-accent-hover: var(--fill-green-600);
  --pg-btn-accent-active: var(--fill-green-700);
  --pg-btn-accent-muted: var(--fill-green-50);
  --pg-btn-accent-muted-hover: var(--fill-green-100);
  --pg-btn-on-accent: oklch(1 0 0);
}

.pg-button--warning {
  --pg-btn-accent: var(--fill-amber-500);
  --pg-btn-accent-hover: var(--fill-amber-600);
  --pg-btn-accent-active: var(--fill-amber-700);
  --pg-btn-accent-muted: var(--fill-amber-50);
  --pg-btn-accent-muted-hover: var(--fill-amber-100);
  --pg-btn-on-accent: oklch(0.15 0 0);
}

.pg-button--info {
  --pg-btn-accent: var(--fill-blue-500);
  --pg-btn-accent-hover: var(--fill-blue-600);
  --pg-btn-accent-active: var(--fill-blue-700);
  --pg-btn-accent-muted: var(--fill-blue-50);
  --pg-btn-accent-muted-hover: var(--fill-blue-100);
  --pg-btn-on-accent: oklch(1 0 0);
}

.pg-button--secondary {
  --pg-btn-accent: var(--fill-violet-500);
  --pg-btn-accent-hover: var(--fill-violet-600);
  --pg-btn-accent-active: var(--fill-violet-700);
  --pg-btn-accent-muted: var(--fill-violet-50);
  --pg-btn-accent-muted-hover: var(--fill-violet-100);
  --pg-btn-on-accent: oklch(1 0 0);
}

/* ─── Variants ─── */

.pg-button--solid {
  background-color: var(--pg-btn-accent);
  border-color: var(--pg-btn-accent);
  color: var(--pg-btn-on-accent);
}
.pg-button--solid:hover:not(:disabled) {
  background-color: var(--pg-btn-accent-hover);
  border-color: var(--pg-btn-accent-hover);
}
.pg-button--solid:active:not(:disabled) {
  background-color: var(--pg-btn-accent-active);
  border-color: var(--pg-btn-accent-active);
}

.pg-button--outline {
  background-color: transparent;
  border-color: var(--pg-btn-accent);
  color: var(--pg-btn-accent);
}
.pg-button--outline:hover:not(:disabled) {
  background-color: var(--pg-btn-accent-muted);
}
.pg-button--outline:active:not(:disabled) {
  background-color: var(--pg-btn-accent-muted-hover);
}

.pg-button--ghost {
  background-color: transparent;
  border-color: transparent;
  color: var(--pg-btn-accent);
}
.pg-button--ghost:hover:not(:disabled) {
  background-color: var(--pg-btn-accent-muted);
}
.pg-button--ghost:active:not(:disabled) {
  background-color: var(--pg-btn-accent-muted-hover);
}

.pg-button--soft {
  background-color: var(--pg-btn-accent-muted);
  border-color: transparent;
  color: var(--pg-btn-accent);
}
.pg-button--soft:hover:not(:disabled) {
  background-color: var(--pg-btn-accent-muted-hover);
}

.pg-button--link {
  background-color: transparent;
  border-color: transparent;
  color: var(--pg-btn-accent);
  padding-inline: 0;
  text-decoration-line: underline;
  text-underline-offset: 0.125rem;
}
.pg-button--link:hover:not(:disabled) {
  color: var(--pg-btn-accent-hover);
}

/* ─── States ─── */

.pg-button:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.pg-button--loading {
  cursor: wait;
}

/* ─── Spinner ─── */

.pg-button__spinner {
  flex-shrink: 0;
  inline-size: 1em;
  block-size: 1em;
  animation: pg-spin 0.7s linear infinite;
}

@keyframes pg-spin {
  to {
    transform: rotate(360deg);
  }
}

/* ─── Dark mode ─── */

.dark .pg-button--neutral {
  --pg-btn-accent: var(--fill-gray-300);
  --pg-btn-accent-hover: var(--fill-gray-200);
  --pg-btn-accent-active: var(--fill-gray-100);
  --pg-btn-accent-muted: var(--fill-gray-800);
  --pg-btn-accent-muted-hover: var(--fill-gray-700);
  --pg-btn-on-accent: oklch(0.15 0 0);
}

.dark .pg-button--primary {
  --pg-btn-accent-muted: oklch(0.24 0.06 152);
  --pg-btn-accent-muted-hover: oklch(0.28 0.08 152);
}
</style>
