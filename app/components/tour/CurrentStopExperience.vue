<template>
  <section
    class="mx-4 grid gap-3 rounded-xl border p-4"
    :aria-label="$t('experience.title')"
  >
    <h2 class="text-lg font-semibold">{{ $t("experience.title") }}</h2>
    <p class="text-sm">{{ $t("experience.intro") }}</p>
    <p v-if="error" role="alert">{{ error }}</p>
    <p v-if="store.needsReconciliation" role="status">
      {{ $t("experience.reconcileRequired") }}
    </p>
    <div class="flex flex-wrap gap-2">
      <button
        v-if="store.hasPending"
        class="rounded border px-3 py-2"
        :disabled="
          requestBusy || store.busy || store.needsReconciliation || saving
        "
        @click="perform(() => store.retry())"
      >
        {{ $t("experience.retry") }}
      </button>
      <button
        class="rounded border px-3 py-2"
        :disabled="requestBusy || store.busy || saving"
        @click="refresh"
      >
        {{ $t("experience.refresh") }}
      </button>
    </div>
    <template v-if="store.view">
      <p class="text-sm" role="status">
        {{
          $t("experience.effectiveInteractionStyle", {
            mode: $t(`experience.interactionModes.${effectiveInteractionMode}`),
          })
        }}
      </p>
      <label class="grid gap-1"
        >{{ $t("experience.stop") }}
        <select
          v-model="selected"
          class="rounded border p-2"
          :disabled="blocked"
          @change="selectStop"
        >
          <option value="" disabled>{{ $t("experience.selectStop") }}</option>
          <option
            v-for="stop in store.view.stops"
            :key="stop.id"
            :value="stop.id"
          >
            {{ stop.name }}
          </option>
        </select>
      </label>
      <label
        ><input
          v-model="useGps"
          type="checkbox"
          :disabled="positionMode !== 'gps'"
        />
        {{ $t("experience.useGps") }}</label
      >
      <p v-if="positionMode !== 'gps'" class="text-sm">
        {{ $t("experience.textGpsManual") }}
      </p>
      <div class="flex flex-wrap gap-2">
        <button
          class="rounded border px-3 py-2"
          :disabled="blocked || !selected"
          @click="
            send({
              action: 'ASK',
              text: t('experience.nextStopQuery'),
              stop_id: selected,
            })
          "
        >
          {{ $t("experience.nextStopDirections") }}
        </button>
        <button
          class="rounded border px-3 py-2"
          :disabled="blocked || !selected"
          @click="
            send({
              action: 'ASK',
              text: t('experience.timeQuery'),
              stop_id: selected,
            })
          "
        >
          {{ $t("experience.checkTime") }}
        </button>
      </div>
      <p class="text-sm" role="status">
        {{ $t(`experience.${store.view.location_status}`) }}
      </p>
      <p v-if="store.view.remaining_minutes !== null" class="text-sm">
        {{
          $t("experience.timeLeft", { minutes: store.view.remaining_minutes })
        }}
      </p>
      <aside
        v-if="store.view.navigation?.status"
        class="grid gap-2 rounded border p-3"
        :aria-label="$t('experience.walkingDirections')"
      >
        <h3 class="font-medium">{{ $t("experience.walkingDirections") }}</h3>
        <p>
          {{
            $t(`experience.navigationStatus.${store.view.navigation.status}`)
          }}
        </p>
        <p v-if="store.view.navigation.target_name">
          {{ store.view.navigation.target_name }}
        </p>
        <p
          v-if="store.view.navigation.walking_minutes !== undefined"
          class="text-sm"
        >
          {{
            $t("experience.walkingTime", {
              minutes: store.view.navigation.walking_minutes,
            })
          }}
        </p>
        <div v-if="directions.length">
          <h4 class="font-medium">{{ $t("experience.nextInstruction") }}</h4>
          <p>{{ directions[0] }}</p>
          <details v-if="directions.length > 1" class="mt-2">
            <summary>{{ $t("experience.allInstructions") }}</summary>
            <ol class="list-inside list-decimal">
              <li v-for="(instruction, index) in directions" :key="index">
                {{ instruction }}
              </li>
            </ol>
          </details>
        </div>
        <p
          v-for="warning in store.view.navigation.warnings"
          :key="warning"
          class="text-sm"
        >
          {{ warning }}
        </p>
      </aside>
      <p v-if="store.view.limitation" class="text-sm">
        {{ $t("experience.noEvidence") }}
      </p>
      <div
        v-if="store.view.activity"
        class="rounded bg-gray-100 p-3 dark:bg-gray-800"
        role="status"
      >
        {{ $t(`experience.activity${store.view.activity}`) }}
        <p class="text-sm">{{ $t("experience.activityHint") }}</p>
      </div>
      <div class="flex flex-wrap gap-2">
        <button
          v-for="action in actions"
          :key="action"
          class="rounded border px-3 py-2"
          :disabled="blocked"
          @click="send({ action })"
        >
          {{ $t(`experience.action${action}`) }}
        </button>
      </div>
      <div
        v-for="cue in store.view.cues"
        :key="cue.id"
        class="rounded border p-3"
      >
        <p>{{ cue.text }}</p>
        <p
          v-for="limitation in cue.limitations"
          :key="limitation"
          class="text-sm"
        >
          {{ limitation }}
        </p>
        <button
          class="mt-2 rounded border px-3 py-2"
          :disabled="blocked"
          @click="
            send({
              action:
                cue.kind === 'LOCAL_TALK'
                  ? 'LOCAL_TALK'
                  : cue.kind === 'PHOTO'
                    ? 'PHOTO'
                    : 'OBSERVE',
              cue_id: cue.id,
            })
          "
        >
          {{ $t("experience.tryActivity") }}
        </button>
      </div>
      <ol
        class="grid max-h-96 gap-3 overflow-auto"
        aria-live="polite"
        :aria-label="$t('experience.conversation')"
      >
        <li
          v-for="turn in store.view.turns"
          :key="turn.id"
          class="rounded bg-gray-50 p-3 whitespace-pre-wrap dark:bg-gray-900"
        >
          <strong>{{
            turn.role === "visitor"
              ? $t("experience.you")
              : $t("experience.guide")
          }}</strong>
          <p class="text-xs">
            {{ $t("experience.turnStop", { stop: stopName(turn.stop_id) }) }}
          </p>
          <p>{{ turn.text }}</p>
          <ul v-if="turn.source_ids.length" class="mt-2 text-xs">
            <li v-for="source in store.sourcesForTurn(turn)" :key="source.id">
              <a
                v-if="safeUrl(source.url)"
                :href="source.url"
                target="_blank"
                rel="noopener noreferrer"
                class="underline"
                >{{ source.title }}</a
              >
              <span v-else>{{ source.title }}</span>
            </li>
          </ul>
          <p
            v-if="store.sourcesForTurn(turn).length < turn.source_ids.length"
            class="text-xs"
          >
            {{ $t("experience.earlierSourcesUnavailable") }}
          </p>
        </li>
      </ol>
      <form class="grid gap-2" @submit.prevent="ask">
        <label for="stop-question">{{ $t("experience.question") }}</label>
        <textarea
          id="stop-question"
          v-model="question"
          maxlength="4000"
          rows="2"
          class="rounded border p-2"
        />
        <button
          type="submit"
          class="rounded border px-3 py-2"
          :disabled="blocked || !selected || !question.trim()"
        >
          {{ $t("experience.send") }}
        </button>
      </form>
      <details v-if="store.view.sources.length">
        <summary>{{ $t("experience.sources") }}</summary>
        <ul>
          <li v-for="source in store.view.sources" :key="source.id">
            <a
              v-if="safeUrl(source.url)"
              :href="source.url"
              target="_blank"
              rel="noopener noreferrer"
              class="underline"
              >{{ source.title }}</a
            ><span v-else>{{ source.title }}</span> —
            {{ $t("experience.checked") }}
            {{ new Date(source.checked_at).toLocaleDateString(locale) }}
          </li>
        </ul>
      </details>
      <PersonalContextForm v-model="context" :guide-mode="guideMode" />
      <div class="flex flex-wrap gap-2">
        <button
          class="rounded border px-3 py-2"
          :disabled="blocked"
          @click="send({ action: 'UPDATE_CONTEXT', context })"
        >
          {{ $t("experience.applyContext") }}
        </button>
        <button
          class="rounded border px-3 py-2"
          :disabled="blocked"
          @click="send({ action: 'FORGET_CONTEXT' })"
        >
          {{ $t("experience.forget") }}
        </button>
        <button
          class="rounded border px-3 py-2"
          :disabled="blocked"
          @click="saveFuture(context)"
        >
          {{ $t("experience.saveFuture") }}
        </button>
        <button
          class="rounded border px-3 py-2"
          :disabled="blocked"
          @click="saveFuture(null)"
        >
          {{ $t("experience.clearFuture") }}
        </button>
      </div>
      <p v-if="saved" role="status">{{ $t("experience.saved") }}</p>
    </template>
  </section>
</template>
<script setup lang="ts">
import {
  computed,
  nextTick,
  onBeforeUnmount,
  onMounted,
  ref,
  watch,
} from "vue";
import { useExperienceStore } from "~/stores/experienceStore";
import { useGeolocationStore } from "~/stores/geolocationStore";
import { useExperienceLocation } from "~/composables/tour/useExperienceLocation";
import { usePositionMode } from "~/composables/map/usePositionMode";
import { useTourRequestStore } from "~/stores/tourRequestStore";
import { useUserStore } from "~/stores/userStore";
import { experienceErrorKey } from "~/utils/experienceErrors";
import { safeSourceUrl as safeUrl } from "~/utils/safeText";
import { useAuth } from "~/composables/auth/useAuth";
import type { Interaction, Intent } from "~/types/tourExperience";
import {
  emptyPersonalContext,
  type PersonalContext,
} from "~/types/personalContext";
import { navigationInstructions } from "~/utils/navigationInstructions";
import PersonalContextForm from "./PersonalContextForm.vue";
import {
  normalizeGuideInteractionMode,
  type GuideInteractionMode,
} from "#shared/types/guideInteraction";
const props = defineProps<{
  beforeVisitorAction?: () => Promise<void>;
  tourId: string;
  requestBusy?: boolean;
  guideMode?: GuideInteractionMode;
}>();
const { positionMode } = usePositionMode();
const requests = useTourRequestStore();
const users = useUserStore();
const visible = ref(false);
const store = useExperienceStore(),
  geo = useGeolocationStore(),
  auth = useAuth();
const { t, locale } = useI18n();
const selected = ref(""),
  question = ref(""),
  error = ref(""),
  useGps = ref(false),
  context = ref(emptyPersonalContext()),
  saved = ref(false),
  saving = ref(false);
const requestBusy = computed(
  () => !!props.requestBusy || requests.isBusy(props.tourId),
);
const blocked = computed(
  () =>
    requestBusy.value ||
    store.busy ||
    store.hasPending ||
    store.needsReconciliation ||
    saving.value,
);
const effectiveInteractionMode = computed(() =>
  normalizeGuideInteractionMode(store.view?.interaction_mode),
);
const directions = computed(() =>
  navigationInstructions(store.view?.navigation),
);
const stopName = (id: string) =>
  store.view?.stops.find((stop) => stop.id === id)?.name ??
  t("experience.earlierStop");
const buttons: Intent[] = [
  "MORE",
  "SHORTER",
  "KNOW_THIS",
  "PHOTO",
  "BREAK",
  "LOCAL_TALK",
  "DONE",
  "SKIP",
];
const actions = computed(() =>
  buttons.filter((a) => store.view?.available_actions.includes(a)),
);
let session = 0;
let initialContextRead: { session: number; snapshot: string } | null = null;
let alive = true,
  timer: ReturnType<typeof setInterval> | undefined;
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
async function send(input: Interaction) {
  if (blocked.value) return false;
  return perform(async () => {
    const current = session;
    if (input.action !== "LOCATION_UPDATE") await props.beforeVisitorAction?.();
    if (!alive || current !== session || blocked.value)
      throw new Error("The current stop changed");
    await store.act({ ...input, type_llm: auth.userPreferences.value.llmType });
  });
}
async function selectStop() {
  if (!(await send({ action: "CONTINUE", stop_id: selected.value })))
    selected.value = store.view?.stop_id ?? "";
}
async function refresh() {
  if (requestBusy.value || saving.value) return;
  if (await perform(() => store.refresh())) {
    location.reconcile();
    await location.sync();
  }
}
async function ask() {
  const text = question.value;
  if (
    await send({
      action: store.view?.activity === "QUESTION" ? "ANSWER" : "ASK",
      text,
      stop_id: selected.value,
    })
  ) {
    if (question.value === text) question.value = "";
  }
}
async function saveFuture(value: PersonalContext | null) {
  if (blocked.value) return;
  const current = session;
  saving.value = true;
  saved.value = false;
  await perform(async () => {
    const didSave = await users.savePersonalContext(
      value,
      () => alive && current === session,
    );
    if (didSave && alive && current === session) {
      saved.value = true;
    }
  });
  if (current === session) saving.value = false;
}
watch(
  () => store.view,
  (view) => {
    selected.value = view?.stop_id ?? "";
  },
  { immediate: true },
);
watch(
  () => JSON.stringify(store.view?.personal_context),
  () => {
    if (!store.view) return;
    if (
      initialContextRead?.session === session &&
      JSON.stringify(context.value) !== initialContextRead.snapshot
    )
      return;
    context.value = JSON.parse(JSON.stringify(store.view.personal_context));
  },
  { immediate: true },
);
const location = useExperienceLocation({
  enabled: computed(
    () => useGps.value && positionMode.value === "gps" && visible.value,
  ),
  blocked: computed(() => blocked.value || !visible.value),
  ready: computed(() => !!store.view),
  hasLocation: computed(
    () =>
      store.view?.location_status === "GPS_CONFIRMED" ||
      store.view?.navigation?.status === "available",
  ),
  fix: computed(() =>
    geo.coordinates && !geo.error && geo.accuracy !== null && geo.recordedAt
      ? {
          point: {
            lng: String(geo.coordinates[0]),
            lat: String(geo.coordinates[1]),
          },
          accuracy: geo.accuracy,
          recorded_at: geo.recordedAt,
        }
      : {},
  ),
  send,
});
watch(
  () => [props.tourId, auth.user.value?.uid] as const,
  async ([tour, uid]) => {
    session++;
    question.value = "";
    error.value = "";
    context.value = emptyPersonalContext();
    selected.value = "";
    saved.value = false;
    saving.value = false;
    useGps.value = false;
    location.reset();
    if (uid) {
      const current = session;
      await perform(async () => {
        const loading = store.load(tour, uid);
        // load resets a changed tour/account before returning its promise.
        if (store.view) {
          context.value = JSON.parse(
            JSON.stringify(store.view.personal_context),
          );
          selected.value = store.view.stop_id ?? "";
        }
        initialContextRead = {
          session: current,
          snapshot: JSON.stringify(context.value),
        };
        try {
          await loading;
          await nextTick();
        } finally {
          if (initialContextRead?.session === current)
            initialContextRead = null;
        }
      });
    } else store.reset();
  },
  { immediate: true },
);
function onVisibility() {
  visible.value = !document.hidden;
  if (
    visible.value &&
    !requestBusy.value &&
    !store.busy &&
    !saving.value &&
    store.view
  ) {
    void perform(() => store.reconcile()).then(async (reconciled) => {
      if (reconciled) {
        location.reconcile();
        await location.sync();
      }
    });
  }
}
onMounted(() => {
  visible.value = !document.hidden;
  document.addEventListener("visibilitychange", onVisibility);
  timer = setInterval(() => void location.sync(), 10000);
});
onBeforeUnmount(() => {
  alive = false;
  document.removeEventListener("visibilitychange", onVisibility);
  if (timer) clearInterval(timer);
  store.reset();
});
</script>
