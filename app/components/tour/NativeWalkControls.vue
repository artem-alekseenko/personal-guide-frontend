<script setup lang="ts">
import { shallowRef } from "vue";
import type { WalkView } from "#shared/types/nativeWalk";
defineProps<{
  view: WalkView;
  blocked: boolean;
  playing: boolean;
  rendering: boolean;
  locallyPaused: boolean;
  subjects: { id: string; name: string }[];
}>();
const emit = defineEmits<{
  start: [];
  pause: [];
  resume: [];
  continue: [];
  more: [];
  finish: [];
  play: [];
  interrupt: [];
  read: [];
  mode: [automatic: boolean];
  ask: [question: string, subjectId?: string];
}>();
const question = shallowRef("");
const subject = shallowRef("");
function ask() {
  if (question.value.trim())
    emit("ask", question.value.trim(), subject.value || undefined);
}
</script>
<template>
  <div class="grid min-w-0 gap-4">
    <div
      class="flex flex-wrap gap-3"
      role="group"
      :aria-label="$t('nativeWalk.walkControls')"
    >
      <PGButton
        v-if="!view.started"
        :disabled="blocked"
        @click="emit('start')"
        >{{ $t("nativeWalk.start") }}</PGButton
      >
      <PGButton
        v-else-if="view.paused || locallyPaused"
        :disabled="blocked"
        @click="emit('resume')"
        >{{ $t("buttons.resume") }}</PGButton
      >
      <PGButton v-else @click="emit('pause')">{{
        $t("buttons.pause")
      }}</PGButton>
      <PGButton
        :disabled="
          blocked || !view.started || view.paused || !!view.active_delivery
        "
        @click="emit('continue')"
        >{{ $t("nativeWalk.continue") }}</PGButton
      >
      <PGButton
        :disabled="
          blocked ||
          !view.context.discussion_subject_id ||
          !!view.active_delivery ||
          view.paused
        "
        @click="emit('more')"
        >{{ $t("nativeWalk.more") }}</PGButton
      >
      <PGButton :disabled="blocked" color="neutral" @click="emit('finish')">{{
        $t("nativeWalk.finish")
      }}</PGButton>
    </div>
    <label class="flex min-h-11 items-center gap-3">
      <input
        type="checkbox"
        :checked="view.scheduling_mode === 'automatic'"
        :disabled="blocked"
        @change="emit('mode', ($event.target as HTMLInputElement).checked)"
      />
      {{ $t("nativeWalk.automatic") }}
    </label>
    <div v-if="view.active_delivery" class="flex flex-wrap gap-3">
      <PGButton
        v-if="!playing"
        :disabled="blocked || rendering || view.paused"
        @click="emit('play')"
        >{{ $t("nativeWalk.play") }}</PGButton
      >
      <PGButton
        :disabled="blocked"
        variant="outline"
        @click="emit('interrupt')"
        >{{ $t("nativeWalk.interrupt") }}</PGButton
      >
      <PGButton :disabled="blocked" variant="outline" @click="emit('read')">{{
        $t("nativeWalk.read")
      }}</PGButton>
    </div>
    <form class="grid gap-3" @submit.prevent="ask">
      <label for="walk-subject">{{ $t("nativeWalk.discuss") }}</label>
      <select
        id="walk-subject"
        v-model="subject"
        class="border-default bg-default min-h-11 rounded-lg border p-2"
        :disabled="blocked"
      >
        <option value="">{{ $t("nativeWalk.currentDiscussion") }}</option>
        <option v-for="item in subjects" :key="item.id" :value="item.id">
          {{ item.name }}
        </option>
      </select>
      <label for="walk-question">{{ $t("nativeWalk.question") }}</label>
      <textarea
        id="walk-question"
        v-model="question"
        maxlength="4000"
        rows="3"
        class="border-default bg-default w-full rounded-lg border p-3"
        :disabled="blocked"
      />
      <PGButton
        type="submit"
        :disabled="
          blocked ||
          !question.trim() ||
          !view.started ||
          !!view.active_delivery ||
          view.paused
        "
        >{{ $t("nativeWalk.ask") }}</PGButton
      >
    </form>
  </div>
</template>
