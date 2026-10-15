<script setup lang="ts">
import {
  computed,
  nextTick,
  onBeforeUnmount,
  onMounted,
  shallowRef,
  watch,
} from "vue";
import { useExperienceStore } from "~/stores/experienceStore";
import { useTourRequestStore } from "~/stores/tourRequestStore";
import { useAuth } from "~/composables/auth/useAuth";
import { experienceErrorKey } from "~/utils/experienceErrors";
import { safeSourceUrl } from "~/utils/safeText";
import PGButton from "~/components/ui/PGButton.vue";

const props = defineProps<{
  tourId: string;
  generationId?: string | null;
  requestBusy?: boolean;
  beforeVisitorAction?: () => Promise<void>;
}>();

const store = useExperienceStore();
const requests = useTourRequestStore();
const auth = useAuth();
const { t } = useI18n();
const question = shallowRef("");
const error = shallowRef("");
const loading = shallowRef(false);
const acting = shallowRef(false);
let alive = true;
let session = 0;
let pendingQuestion: { session: number; text: string } | null = null;

const requestBusy = computed(
  () => !!props.requestBusy || requests.isBusy(props.tourId),
);
const unavailable = computed(
  () =>
    !auth.user.value?.uid ||
    requestBusy.value ||
    loading.value ||
    !store.ready ||
    store.busy ||
    store.needsReconciliation,
);
const blocked = computed(
  () => unavailable.value || acting.value || store.hasPending,
);
const recoveryBusy = computed(
  () => requestBusy.value || loading.value || acting.value || store.busy,
);
const canSend = computed(() => !blocked.value && !!question.value.trim());
const showRecovery = computed(
  () =>
    !!error.value ||
    store.hasPending ||
    store.needsReconciliation ||
    (!store.view && !loading.value),
);
const visibleTurns = computed(() =>
  (store.view?.turns ?? [])
    .filter((turn) => turn.text.trim())
    .map((turn) => ({
      turn,
      sources: store.sourcesForTurn(turn),
    })),
);
const reviewLinks = computed(() =>
  (store.view?.sources ?? []).filter(
    (source) =>
      source.kind === "external_review_link" && safeSourceUrl(source.url),
  ),
);

async function perform(task: () => Promise<unknown>) {
  const current = session;
  error.value = "";
  try {
    await task();
    return alive && current === session;
  } catch (failure) {
    if (alive && current === session)
      error.value = t(experienceErrorKey(failure));
    return false;
  }
}

function clearConfirmedQuestion(current: number) {
  if (alive && current === session && pendingQuestion?.session === current) {
    if (question.value === pendingQuestion.text) question.value = "";
    pendingQuestion = null;
  }
}

async function ask() {
  if (!canSend.value) return;
  const current = session;
  const text = question.value;
  acting.value = true;
  try {
    const confirmed = await perform(async () => {
      await props.beforeVisitorAction?.();
      if (!alive || current !== session) return;
      if (unavailable.value || store.hasPending)
        throw new Error("The current tour changed");
      pendingQuestion = { session: current, text };
      await store.act({
        action: "ASK_GENERAL",
        text,
        type_llm: auth.userPreferences.value.llmType,
      });
      await nextTick();
    });
    if (confirmed && !store.hasPending) clearConfirmedQuestion(current);
    if (current === session && !store.hasPending) pendingQuestion = null;
  } finally {
    if (current === session) acting.value = false;
  }
}

async function retry() {
  if (recoveryBusy.value || unavailable.value || !store.hasPending) return;
  const current = session;
  acting.value = true;
  try {
    const confirmed = await perform(async () => {
      await props.beforeVisitorAction?.();
      if (!alive || current !== session) return;
      if (unavailable.value || !store.hasPending)
        throw new Error("The current tour changed");
      await store.retry();
      await nextTick();
    });
    if (confirmed && !store.hasPending) clearConfirmedQuestion(current);
    if (current === session && !store.hasPending) pendingQuestion = null;
  } finally {
    if (current === session) acting.value = false;
  }
}

async function refresh() {
  if (recoveryBusy.value || !auth.user.value?.uid) return;
  const current = ++session;
  pendingQuestion = null;
  loading.value = true;
  try {
    await perform(() => store.refresh());
  } finally {
    if (current === session) loading.value = false;
  }
}

watch(
  () => [props.tourId, auth.user.value?.uid, props.generationId] as const,
  async ([tour, uid, generation]) => {
    const current = ++session;
    question.value = "";
    error.value = "";
    pendingQuestion = null;
    acting.value = false;
    loading.value = !!uid;
    if (!uid) {
      store.reset();
      return;
    }
    try {
      await perform(() => store.load(tour, uid, generation));
    } finally {
      if (current === session) loading.value = false;
    }
  },
  { immediate: true, flush: "sync" },
);

function onVisibility() {
  if (!document.hidden && !recoveryBusy.value && store.view) {
    // A visibility read must retain an uncertain question's payload and key.
    const current = session;
    loading.value = true;
    void perform(() => store.reconcile()).finally(() => {
      if (current === session) loading.value = false;
    });
  }
}

onMounted(() => {
  document.addEventListener("visibilitychange", onVisibility);
});
onBeforeUnmount(() => {
  alive = false;
  session++;
  document.removeEventListener("visibilitychange", onVisibility);
  store.reset();
});
</script>

<template>
  <div
    class="mx-4 grid max-w-3xl min-w-0 gap-4 break-words"
    :aria-busy="loading || acting || store.busy"
  >
    <p v-if="loading || store.busy" class="text-sm" role="status">
      {{ $t("common.loading") }}
    </p>
    <p v-if="error" class="text-sm" role="alert">{{ error }}</p>
    <p v-if="store.needsReconciliation" class="text-sm" role="status">
      {{ $t("experience.reconcileRequired") }}
    </p>
    <div v-if="showRecovery" class="flex flex-wrap gap-2">
      <PGButton
        v-if="store.hasPending"
        variant="outline"
        color="neutral"
        :disabled="recoveryBusy || unavailable"
        @click="retry"
      >
        {{ $t("experience.retry") }}
      </PGButton>
      <PGButton
        variant="outline"
        color="neutral"
        :disabled="recoveryBusy || !auth.user.value?.uid"
        @click="refresh"
      >
        {{ $t("experience.refresh") }}
      </PGButton>
    </div>
    <form class="grid min-w-0 gap-3" @submit.prevent="ask">
      <label for="general-question" class="sr-only">
        {{ $t("experience.question") }}
      </label>
      <textarea
        id="general-question"
        v-model="question"
        maxlength="4000"
        rows="3"
        :placeholder="$t('experience.askAnything')"
        class="question-input w-full min-w-0 resize-y rounded-2xl px-5 py-4 text-base leading-relaxed"
      />
      <PGButton
        type="submit"
        class="justify-self-start"
        :disabled="!canSend"
        :loading="acting"
      >
        {{ $t("experience.ask") }}
      </PGButton>
    </form>
    <aside
      v-if="reviewLinks.length"
      class="rounded border border-gray-200 p-3 text-sm dark:border-gray-700"
      :aria-label="$t('experience.externalReviews')"
    >
      <ul>
        <li v-for="source in reviewLinks" :key="source.id">
          <a
            :href="source.url"
            target="_blank"
            rel="noopener noreferrer"
            class="underline"
          >
            <span
              translate="no"
              class="font-normal whitespace-nowrap"
            >Google Maps</span>
            — {{ $t("experience.openPlaceReviews") }}
          </a>
        </li>
      </ul>
      <p class="mt-2 text-xs">{{ $t("experience.externalReviewsNotice") }}</p>
    </aside>
    <ol
      v-if="visibleTurns.length"
      class="grid max-h-96 min-w-0 gap-3 overflow-auto"
      aria-live="polite"
      :aria-label="$t('experience.conversation')"
    >
      <li
        v-for="{ turn, sources } in visibleTurns"
        :key="turn.id"
        class="min-w-0 rounded bg-gray-50 p-3 break-words whitespace-pre-wrap dark:bg-gray-900"
      >
        <strong>{{
          turn.role === "visitor"
            ? $t("experience.you")
            : $t("experience.guide")
        }}</strong>
        <p>{{ turn.text }}</p>
        <ul v-if="sources.length" class="mt-2 text-xs">
          <li v-for="source in sources" :key="source.id">
            <a
              v-if="safeSourceUrl(source.url)"
              :href="source.url"
              target="_blank"
              rel="noopener noreferrer"
              class="underline"
              >{{ source.title }}</a
            >
            <span v-else>{{ source.title }}</span>
          </li>
        </ul>
        <p v-if="sources.length < turn.source_ids.length" class="text-xs">
          {{ $t("experience.earlierSourcesUnavailable") }}
        </p>
      </li>
    </ol>
  </div>
</template>

<style scoped>
.question-input {
  min-block-size: 7.5rem;
  border: 1px solid var(--ui-border);
  background: var(--ui-bg-muted);
  color: var(--ui-text);
  transition:
    border-color 0.15s ease,
    box-shadow 0.15s ease;
}

.question-input::placeholder {
  color: var(--ui-text-muted);
}

.question-input:focus {
  border-color: var(--ui-primary);
  outline: 2px solid var(--ui-primary);
  outline-offset: 3px;
  box-shadow: 0 0 0 4px color-mix(in srgb, var(--ui-primary) 12%, transparent);
}
</style>
