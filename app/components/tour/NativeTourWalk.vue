<script setup lang="ts">
import { computed, onBeforeUnmount, shallowRef, watch } from "vue";
import type { ICreatedTour } from "~/types";
import type { WalkKnowledge } from "#shared/types/nativeWalk";
import { useNativeWalk } from "~/composables/tour/useNativeWalk";
import { useNotification } from "~/composables/ui/useNotification";
import NativeWalkMap from "./NativeWalkMap.vue";
import NativeWalkControls from "./NativeWalkControls.vue";
import NativeWalkPreparation from "./NativeWalkPreparation.vue";
const emit = defineEmits<{ updated: [] }>();
const props = defineProps<{ tour: ICreatedTour }>();
const { t } = useI18n();
const walk = useNativeWalk(props.tour.id);
const knowledge = shallowRef<WalkKnowledge | null>(null);
const plan = computed(() => props.tour.route.walking_plan!);
const view = walk.view;
const subjects = computed(() => knowledge.value?.subjects ?? []);
const remaining = computed(() =>
  Math.ceil((view.value?.remaining_seconds ?? 0) / 60),
);
const distance = computed(() =>
  Math.round(view.value?.progress?.distance_meters ?? 0),
);
const blocked = computed(
  () =>
    !walk.ready.value || !!view.value?.finished || walk.generationChanged.value,
);
const latestText = computed(
  () => view.value?.active_delivery?.text || walk.lastText.value,
);
const unverified = computed(() =>
  view.value?.active_delivery
    ? view.value.active_delivery.evidence_status === "unverified"
    : walk.lastUnverified.value,
);
function reloadTour() {
  reloadNuxtApp({ path: `/tours/${encodeURIComponent(props.tour.id)}` });
}
async function safely(action: () => unknown) {
  try {
    await action();
  } catch (error) {
    useNotification().showApiError(error, t("nativeWalk.actionFailed"));
  }
}
const { $apiFetch } = useNuxtApp();
let knowledgeEpoch = 0;
watch(
  () => view.value?.generation_id,
  async (generationId) => {
    const epoch = ++knowledgeEpoch;
    knowledge.value = null;
    if (!generationId) return;
    try {
      const result = await ($apiFetch as typeof $fetch)<WalkKnowledge>(
        `/api/native-walk/${encodeURIComponent(props.tour.id)}/knowledge`,
      );
      if (
        epoch === knowledgeEpoch &&
        result.generation_id === generationId &&
        result.route_revision === view.value?.route_revision &&
        result.language === view.value?.language
      )
        knowledge.value = result;
    } catch {
      /* Optional subjects do not gate walking or source-backed playback. */
    }
  },
  { immediate: true },
);
onBeforeUnmount(() => {
  knowledgeEpoch++;
});
</script>
<template>
  <section class="grid min-w-0 gap-4 p-4">
    <h1 class="text-xl font-semibold">
      {{ tour.name || $t("nativeWalk.walkTitle") }}
    </h1>
    <NativeWalkPreparation :tour="tour" @updated="emit('updated')" />
    <NativeWalkMap :plan="plan" />
    <p v-if="!view" role="status">
      {{
        $t(
          walk.preparing.value || tour.status === "GENERATING"
            ? "nativeWalk.preparing"
            : "common.loading",
        )
      }}
    </p>
    <div v-if="walk.generationChanged.value" role="alert" class="grid gap-3">
      <p>{{ $t("nativeWalk.generationChanged") }}</p>
      <PGButton @click="reloadTour">{{ $t("nativeWalk.reloadTour") }}</PGButton>
    </div>
    <p v-if="walk.failed.value" role="alert">
      {{ $t("nativeWalk.actionFailed") }}
    </p>
    <div
      v-if="walk.uncertain.value"
      class="border-warning grid gap-2 rounded-lg border p-3"
      role="alert"
    >
      <p>{{ $t("nativeWalk.uncertain") }}</p>
      <PGButton :disabled="walk.busy.value" @click="safely(walk.retry)">{{
        $t("buttons.tryAgain")
      }}</PGButton>
      <PGButton :disabled="walk.busy.value" @click="safely(walk.reconcile)">{{
        $t("nativeWalk.reload")
      }}</PGButton>
    </div>
    <PGButton
      v-else-if="walk.failed.value"
      :disabled="walk.busy.value"
      @click="safely(walk.reconcile)"
      >{{ $t("nativeWalk.reload") }}</PGButton
    >
    <template v-if="view">
      <p role="status">
        {{
          $t("nativeWalk.progress", {
            meters: distance,
            total: Math.round(plan.distance_meters),
            minutes: remaining,
          })
        }}
      </p>
      <p v-if="!view.progress?.reliable">
        {{ $t("nativeWalk.locationUncertain") }}
      </p>
      <p v-if="view.progress?.reason === 'off_route'" role="status">
        {{ $t("nativeWalk.offRoute") }}
        <NuxtLink to="/create-walk">{{ $t("nativeWalk.newWalk") }}</NuxtLink>
      </p>
      <p v-if="view.research_gaps.length" role="status">
        {{ $t("nativeWalk.knowledgeGap") }}
      </p>
      <p v-if="!walk.canControl.value" role="status">
        {{ $t("nativeWalk.otherController") }}
      </p>
      <p v-if="walk.rendering.value" role="status">
        {{ $t("nativeWalk.loadingAudio") }}
      </p>
      <p v-if="walk.audioUnavailable.value" role="status">
        {{ $t("nativeWalk.audioUnavailable") }}
      </p>
      <article
        v-if="latestText"
        class="border-default rounded-xl border p-4"
        aria-live="polite"
      >
        <p v-if="unverified" class="text-warning">
          {{ $t("nativeWalk.unverified") }}
        </p>
        <p class="leading-relaxed whitespace-pre-wrap">{{ latestText }}</p>
      </article>
      <p v-if="view.finished" role="status">{{ $t("nativeWalk.finished") }}</p>
      <NativeWalkControls
        v-else
        :view="view"
        :blocked="blocked"
        :playing="walk.playing.value"
        :rendering="walk.rendering.value"
        :locally-paused="walk.locallyPaused.value"
        :subjects="subjects"
        @start="safely(walk.start)"
        @pause="safely(walk.pause)"
        @resume="safely(walk.resume)"
        @continue="safely(() => walk.explicit('CONTINUE'))"
        @more="safely(() => walk.explicit('MORE'))"
        @ask="
          (question, subjectId) =>
            safely(() =>
              walk.explicit('ASK', {
                question,
                ...(subjectId ? { subject_id: subjectId } : {}),
              }),
            )
        "
        @finish="safely(walk.finish)"
        @play="safely(walk.playActive)"
        @interrupt="safely(walk.interrupt)"
        @read="safely(walk.readCompleted)"
        @mode="(automatic) => safely(() => walk.setMode(automatic))"
      />
    </template>
    <details
      v-if="plan.instructions.length"
      class="border-default rounded-lg border p-3"
    >
      <summary>{{ $t("nativeWalk.directions") }}</summary>
      <ol class="list-decimal space-y-2 p-4">
        <li v-for="(instruction, index) in plan.instructions" :key="index">
          {{ instruction }}
        </li>
      </ol>
    </details>
    <NuxtLink to="/tours" class="underline">{{
      $t("navigation.backToTours")
    }}</NuxtLink>
  </section>
</template>
