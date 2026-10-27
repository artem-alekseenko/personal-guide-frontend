<script setup lang="ts">
import { computed } from "vue";
import type {
  RouteResearchDepth,
  StoryReadiness,
} from "~/types/tourExperience";

const props = defineProps<{
  depth?: RouteResearchDepth | null;
  readiness?: StoryReadiness | null;
}>();
const { t, locale } = useI18n();
const numberFormat = computed(
  () => new Intl.NumberFormat(locale.value, { maximumFractionDigits: 1 }),
);
const isNonnegative = (value: number | null | undefined): value is number =>
  typeof value === "number" && Number.isFinite(value) && value >= 0;
const formatCount = (value: number | null | undefined) =>
  isNonnegative(value)
    ? numberFormat.value.format(value)
    : t("researchDepth.unknownValue");

function formatMinutes(
  seconds: number | null | undefined,
  target = false,
): string {
  if (!isNonnegative(seconds)) return t("researchDepth.unknownValue");
  // Round capacity down and the target up: a shortfall must not look sufficient.
  const tenths = seconds / 6;
  if (!target && seconds > 0 && tenths < 1)
    return t("researchDepth.lessThanMinutes", {
      minutes: numberFormat.value.format(0.1),
    });
  return t("researchDepth.minutes", {
    minutes: numberFormat.value.format(
      (target ? Math.ceil(tenths) : Math.floor(tenths)) / 10,
    ),
  });
}

const status = computed(() => {
  switch (props.depth?.status) {
    case "NOT_PREPARED":
    case "SHORTFALL":
    case "ENOUGH_SAVED_TEXT":
      return props.depth.status;
    default:
      return "UNKNOWN";
  }
});
const readinessStatus = computed(() => {
  switch (props.readiness?.status) {
    case "NOT_SELECTED":
    case "AVAILABLE":
    case "CONTEXT_ONLY":
    case "UNCHECKED_ACCOUNT":
    case "EXHAUSTED":
    case "MISSING":
      return props.readiness.status;
    default:
      return "UNKNOWN";
  }
});
</script>

<template>
  <section
    class="border-default bg-default text-default grid gap-2 rounded-lg border p-3 text-sm"
    :aria-label="t('researchDepth.title')"
    data-testid="research-coverage"
  >
    <div class="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
      <h3 class="font-medium">{{ t("researchDepth.title") }}</h3>
      <p class="font-medium" role="status" data-testid="research-depth-status">
        {{ t(`researchDepth.status.${status}`) }}
      </p>
    </div>
    <p v-if="depth" data-testid="research-depth-capacity">
      {{
        t("researchDepth.capacity", {
          estimated: formatMinutes(depth?.estimated_seconds),
          target: formatMinutes(depth?.target_seconds, true),
        })
      }}
    </p>
    <p v-if="depth" class="text-muted" data-testid="research-depth-words">
      {{
        t("researchDepth.words", {
          eligible: formatCount(depth?.eligible_words),
          target: formatCount(depth?.target_words),
          missing: formatCount(depth?.missing_words),
        })
      }}
    </p>
    <p
      v-if="depth"
      class="text-muted"
      data-testid="research-depth-verification"
    >
      {{
        t("researchDepth.verification", {
          verified: formatCount(depth?.verified_words),
          unverified: formatCount(depth?.unverified_words),
        })
      }}
    </p>
    <p v-if="readiness" class="border-default border-t pt-2">
      <span class="font-medium">{{ t("researchDepth.currentPlace") }}</span>
      {{ t(`researchDepth.readiness.${readinessStatus}`) }}
    </p>
    <details class="text-muted">
      <summary
        class="focus-visible:outline-primary cursor-pointer rounded-sm focus-visible:outline-2 focus-visible:outline-offset-2"
      >
        {{ t("researchDepth.accounting") }}
      </summary>
      <div class="grid gap-2 pt-2">
        <p>
          {{
            depth?.estimation_method === "deduplicated_claim_text"
              ? t("researchDepth.method", {
                  rate: formatCount(depth?.words_per_minute),
                })
              : t("researchDepth.methodUnknown")
          }}
        </p>
        <p>{{ t("researchDepth.limitations") }}</p>
        <p>{{ t("researchDepth.separateReadiness") }}</p>
      </div>
    </details>
  </section>
</template>
