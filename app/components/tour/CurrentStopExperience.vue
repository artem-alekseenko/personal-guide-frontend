<template>
  <section
    class="mx-4 grid gap-3 rounded-xl border p-4"
    :aria-label="$t('experience.title')"
  >
    <h2 class="text-lg font-semibold">{{ $t("experience.title") }}</h2>
    <p class="text-sm">{{ $t("experience.intro") }}</p>
    <p v-if="error" role="alert">{{ error }}</p>
    <div class="flex flex-wrap gap-2">
      <button
        v-if="store.hasPending"
        class="rounded border px-3 py-2"
        :disabled="store.busy"
        @click="perform(() => store.retry())"
      >
        {{ $t("experience.retry") }}
      </button>
      <button
        class="rounded border px-3 py-2"
        :disabled="store.busy"
        @click="perform(() => store.refresh())"
      >
        {{ $t("experience.refresh") }}
      </button>
    </div>
    <template v-if="store.view">
      <label class="grid gap-1"
        >{{ $t("experience.stop") }}
        <select
          v-model="selected"
          class="rounded border p-2"
          :disabled="blocked"
          @change="send({ action: 'CONTINUE', stop_id: selected })"
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
        ><input v-model="useGps" type="checkbox" />
        {{ $t("experience.useGps") }}</label
      >
      <p class="text-sm" role="status">
        {{ $t(`experience.${store.view.location_status}`) }}
      </p>
      <p v-if="store.view.remaining_minutes !== null" class="text-sm">
        {{
          $t("experience.timeLeft", { minutes: store.view.remaining_minutes })
        }}
      </p>
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
          <p>{{ turn.text }}</p>
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
      <PersonalContextForm v-model="context" />
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
import { computed, onBeforeUnmount, onMounted, ref, watch } from "vue";
import { useExperienceStore } from "~/stores/experienceStore";
import { useGeolocationStore } from "~/stores/geolocationStore";
import { useAuth } from "~/composables/auth/useAuth";
import type { Interaction, Intent } from "~/types/tourExperience";
import type { IServerUserResponse } from "~/types";
import {
  emptyPersonalContext,
  type PersonalContext,
} from "~/types/personalContext";
import PersonalContextForm from "./PersonalContextForm.vue";
const props = defineProps<{ tourId: string }>();
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
const blocked = computed(() => store.busy || store.hasPending || saving.value);
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
let alive = true,
  timer: ReturnType<typeof setInterval> | undefined;
const safeUrl = (url: string) => {
  try {
    return ["https:", "http:"].includes(new URL(url).protocol);
  } catch {
    return false;
  }
};
async function perform(task: () => Promise<unknown>) {
  error.value = "";
  try {
    await task();
    return true;
  } catch {
    if (alive) error.value = t("experience.failed");
    return false;
  }
}
async function send(input: Interaction) {
  return perform(() =>
    store.act({ ...input, type_llm: auth.userPreferences.value.llmType }),
  );
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
  saving.value = true;
  saved.value = false;
  const uid = auth.user.value?.uid;
  await perform(async () => {
    const api = useNuxtApp().$apiFetch as typeof $fetch;
    const profile = await api<IServerUserResponse>("/api/user-profile");
    if (!alive || auth.user.value?.uid !== uid) return;
    await api("/api/user-profile", {
      method: "PUT",
      body: {
        name: profile.name,
        language: profile.language,
        personal_context: value,
      },
    });
    if (alive && auth.user.value?.uid === uid) saved.value = true;
  });
  saving.value = false;
}
watch(
  () => store.view,
  (view) => {
    if (view) {
      selected.value = view.stop_id ?? "";
    }
  },
);
watch(
  () => JSON.stringify(store.view?.personal_context),
  () => {
    if (store.view)
      context.value = JSON.parse(JSON.stringify(store.view.personal_context));
  },
);
watch(
  () => [props.tourId, auth.user.value?.uid] as const,
  async ([tour, uid]) => {
    question.value = "";
    error.value = "";
    context.value = emptyPersonalContext();
    selected.value = "";
    if (uid) await perform(() => store.load(tour, uid));
    else store.reset();
  },
  { immediate: true },
);
async function locate() {
  if (!useGps.value || document.hidden || blocked.value || !store.view) return;
  const fix =
    geo.coordinates && !geo.error && geo.accuracy !== null && geo.recordedAt
      ? {
          point: {
            lng: String(geo.coordinates[0]),
            lat: String(geo.coordinates[1]),
          },
          accuracy: geo.accuracy,
          recorded_at: geo.recordedAt,
        }
      : {};
  await send({ action: "LOCATION_UPDATE", ...fix });
}
watch(useGps, (enabled) => {
  if (enabled) void locate();
  else if (!blocked.value && store.view)
    void send({ action: "LOCATION_UPDATE" });
});
function onVisibility() {
  if (!document.hidden && !blocked.value && store.view)
    void perform(async () => {
      await store.refresh();
      await locate();
    });
}
onMounted(() => {
  document.addEventListener("visibilitychange", onVisibility);
  timer = setInterval(() => void locate(), 10000);
});
onBeforeUnmount(() => {
  alive = false;
  document.removeEventListener("visibilitychange", onVisibility);
  if (timer) clearInterval(timer);
  store.reset();
});
</script>
