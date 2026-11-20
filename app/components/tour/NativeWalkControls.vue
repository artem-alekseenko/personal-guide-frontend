<script setup lang="ts">
import { shallowRef } from "vue";
import type { WalkView } from "#shared/types/nativeWalk";
defineProps<{
  view: WalkView;
  blocked: boolean;
}>();
const emit = defineEmits<{
  next: [];
  finish: [];
  ask: [question: string];
}>();
const question = shallowRef("");
function ask() {
  if (question.value.trim()) emit("ask", question.value.trim());
}
</script>
<template>
  <div class="grid min-w-0 gap-4">
    <div
      v-if="view.started"
      class="grid grid-cols-1 gap-2"
      role="group"
      :aria-label="$t('nativeWalk.walkControls')"
    >
      <PGButton :disabled="blocked" @click="emit('next')">{{
        $t("nativeWalk.nextStep")
      }}</PGButton>
      <PGButton
        :disabled="blocked"
        color="neutral"
        variant="ghost"
        @click="emit('finish')"
        >{{ $t("nativeWalk.finish") }}</PGButton
      >
    </div>
    <form class="grid gap-3" @submit.prevent="ask">
      <textarea
        id="walk-question"
        :aria-label="$t('nativeWalk.question')"
        :placeholder="$t('nativeWalk.question')"
        v-model="question"
        maxlength="4000"
        rows="3"
        class="border-default bg-default w-full rounded-lg border p-3"
        :disabled="blocked || !view.started"
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
