<script setup lang="ts">
defineProps<{ step: 1 | 2; title: string; description: string }>();
const steps = ["guide", "route", "walk"] as const;
</script>

<template>
  <header class="walk-setup-header">
    <ol
      class="walk-setup-header__steps"
      :aria-label="$t('pages.guides.setupSteps')"
    >
      <li
        v-for="(label, index) in steps"
        :key="label"
        class="walk-setup-header__step"
        :class="{
          'walk-setup-header__step--current': step === index + 1,
          'walk-setup-header__step--done': step > index + 1,
        }"
        :aria-current="step === index + 1 ? 'step' : undefined"
      >
        <span class="walk-setup-header__number" aria-hidden="true">
          <svg v-if="step > index + 1" viewBox="0 0 20 20" fill="none">
            <path
              d="m5 10 3 3 7-7"
              stroke="currentColor"
              stroke-width="1.8"
              stroke-linecap="round"
              stroke-linejoin="round"
            />
          </svg>
          <template v-else>{{ index + 1 }}</template>
        </span>
        {{ $t(`pages.guides.steps.${label}`) }}
      </li>
    </ol>
    <div class="walk-setup-header__copy">
      <p class="walk-setup-header__eyebrow">
        {{ $t("pages.guides.heroEyebrow") }}
      </p>
      <h1 class="walk-setup-header__title">{{ title }}</h1>
      <p class="walk-setup-header__description">{{ description }}</p>
    </div>
  </header>
</template>

<style scoped>
.walk-setup-header {
  min-inline-size: 0;
  color: var(--ui-text);
}
.walk-setup-header__steps {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 0.5rem;
  padding: 0 0 1.25rem;
  margin: 0;
  list-style: none;
}
.walk-setup-header__step {
  display: flex;
  align-items: center;
  gap: 0.45rem;
  min-inline-size: 0;
  padding-block-end: 0.75rem;
  border-block-end: 2px solid var(--ui-border);
  color: var(--ui-text-muted);
  font-size: 0.75rem;
  line-height: 1.35;
  overflow-wrap: anywhere;
}
.walk-setup-header__step--current {
  border-color: color-mix(
    in srgb,
    var(--ui-primary) 45%,
    var(--ui-text-highlighted)
  );
  color: var(--ui-text-highlighted);
  font-weight: 700;
}
.walk-setup-header__step--done {
  border-color: color-mix(in srgb, var(--ui-primary) 35%, var(--ui-border));
  color: var(--ui-text);
}
.walk-setup-header__number {
  display: grid;
  place-items: center;
  flex: 0 0 1.5rem;
  inline-size: 1.5rem;
  block-size: 1.5rem;
  border-radius: 50%;
  background: var(--ui-bg-accented);
  font-size: 0.6875rem;
  font-weight: 700;
}
.walk-setup-header__number svg {
  inline-size: 1.125rem;
  block-size: 1.125rem;
}
.walk-setup-header__step--current .walk-setup-header__number {
  background: color-mix(
    in srgb,
    var(--ui-primary) 45%,
    var(--ui-text-highlighted)
  );
  color: var(--ui-bg);
}
.walk-setup-header__step--done .walk-setup-header__number {
  background: color-mix(in srgb, var(--ui-primary) 12%, var(--ui-bg));
  color: color-mix(in srgb, var(--ui-primary) 45%, var(--ui-text-highlighted));
}
.walk-setup-header__copy {
  padding: 0.5rem 0.125rem 0.25rem;
}
.walk-setup-header__eyebrow {
  margin: 0 0 0.625rem;
  color: color-mix(in srgb, var(--ui-primary) 45%, var(--ui-text-highlighted));
  font-size: 0.6875rem;
  font-weight: 750;
  letter-spacing: 0.12em;
  text-transform: uppercase;
}
.walk-setup-header__title {
  max-inline-size: 20ch;
  margin: 0;
  color: var(--ui-text-highlighted);
  font-family: Georgia, serif;
  font-size: clamp(1.875rem, 7vw, 2.25rem);
  font-weight: 500;
  line-height: 1.12;
  letter-spacing: -0.035em;
  text-wrap: balance;
  overflow-wrap: anywhere;
}
.walk-setup-header__description {
  max-inline-size: 45ch;
  margin: 0.75rem 0 0;
  color: var(--ui-text-muted);
  font-size: 0.875rem;
  line-height: 1.65;
}
@media (max-width: 360px) {
  .walk-setup-header__step {
    flex-direction: column;
    align-items: flex-start;
  }
}
</style>
