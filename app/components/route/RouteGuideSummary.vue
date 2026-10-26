<script setup lang="ts">
import { shallowRef } from "vue";
import type { IGuide } from "~/types";
defineProps<{ guide: IGuide }>();
const avatarFailed = shallowRef(false);
// This component is keyed by guide ID and avatar by the parent.
</script>

<template>
  <div class="route-guide-summary">
    <div class="route-guide-summary__portrait">
      <img
        v-if="guide.avatar && !avatarFailed"
        :src="guide.avatar"
        :alt="guide.name"
        width="48"
        height="48"
        @error="avatarFailed = true"
      />
      <span v-else aria-hidden="true">{{
        guide.name.trim().charAt(0).toUpperCase()
      }}</span>
    </div>
    <div class="route-guide-summary__identity">
      <p class="route-guide-summary__label">
        {{ $t("pages.createRoute.yourGuide") }}
      </p>
      <p class="route-guide-summary__name">{{ guide.name }}</p>
    </div>
    <NuxtLink to="/guides" class="route-guide-summary__change">{{
      $t("pages.createRoute.changeGuide")
    }}</NuxtLink>
  </div>
</template>

<style scoped>
.route-guide-summary {
  display: flex;
  align-items: center;
  gap: 0.75rem;
  padding: 0.875rem;
  border: 1px solid color-mix(in srgb, var(--ui-primary) 18%, var(--ui-border));
  border-radius: 1.125rem;
  background: color-mix(in srgb, var(--ui-primary) 5%, var(--ui-bg));
}
.route-guide-summary__portrait {
  display: grid;
  place-items: center;
  flex: 0 0 3rem;
  block-size: 3rem;
  overflow: hidden;
  border-radius: 50%;
  background: color-mix(in srgb, var(--ui-primary) 12%, var(--ui-bg));
  color: var(--ui-text-highlighted);
  font-family: Georgia, serif;
  font-size: 1.375rem;
}
.route-guide-summary__portrait img {
  inline-size: 100%;
  block-size: 100%;
  object-fit: cover;
}
.route-guide-summary__identity {
  flex: 1;
  min-inline-size: 0;
}
.route-guide-summary__label {
  margin: 0 0 0.125rem;
  color: var(--ui-text-muted);
  font-size: 0.6875rem;
}
.route-guide-summary__name {
  margin: 0;
  color: var(--ui-text-highlighted);
  font-size: 0.9375rem;
  font-weight: 650;
  overflow-wrap: anywhere;
}
.route-guide-summary__change {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  min-block-size: 2.75rem;
  padding-inline: 0.25rem;
  color: var(--ui-text);
  font-size: 0.8125rem;
  text-decoration: underline;
  text-underline-offset: 0.25em;
}
.route-guide-summary__change:focus-visible {
  outline: 2px solid var(--ui-primary);
  outline-offset: 3px;
  border-radius: 0.25rem;
}
</style>
