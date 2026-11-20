<script setup lang="ts">
import { ref, watch } from "vue";

const props = defineProps<{ src?: string | null; eager?: boolean }>();
const failed = ref(false);
watch(
  () => props.src,
  () => {
    failed.value = false;
  },
);
</script>

<template>
  <div class="tour-cover" aria-hidden="true">
    <img
      v-if="src?.trim() && !failed"
      :src="src"
      alt=""
      :loading="eager ? 'eager' : 'lazy'"
      decoding="async"
      class="tour-cover__image"
      @error="failed = true"
    />
    <svg
      v-else
      viewBox="0 0 640 260"
      fill="none"
      class="tour-cover__illustration"
    >
      <rect width="640" height="260" fill="#e7eee7" />
      <circle cx="489" cy="69" r="36" fill="#edce91" />
      <path d="M0 159Q100 80 218 143T440 134T640 120V260H0Z" fill="#c6d8c5" />
      <path d="M0 208Q155 157 294 197T640 172V260H0Z" fill="#93b69d" />
      <path
        d="M97 202V112H158V202M105 112L127 87L150 112M181 202V131H250V202M278 202V93H324V202M285 93L301 62L317 93M350 202V122H420V202"
        fill="#f8f5e8"
      />
      <path
        d="M114 132H126V149H114ZM137 132H149V149H137ZM199 150H212V167H199ZM224 150H237V167H224ZM294 112H307V132H294ZM294 147H307V167H294ZM368 143H381V160H368ZM392 143H405V160H392Z"
        fill="#73978b"
      />
      <path d="M0 230Q168 204 318 224T640 210V260H0Z" fill="#56816e" />
      <path
        d="M280 260C304 240 392 240 372 219C359 205 331 207 324 198"
        stroke="#f8f5e8"
        stroke-width="9"
        stroke-linecap="round"
        stroke-dasharray="2 18"
      />
      <path
        d="M477 205V154M477 114C448 137 449 168 477 173C505 168 506 137 477 114ZM534 213V172M534 143C513 159 514 181 534 185C554 181 555 159 534 143Z"
        fill="#365f50"
        stroke="#365f50"
        stroke-width="5"
        stroke-linecap="round"
      />
    </svg>
  </div>
</template>

<style scoped>
.tour-cover {
  width: 100%;
  aspect-ratio: 32 / 13;
  overflow: hidden;
  background: #e7eee7;
}
.tour-cover__image,
.tour-cover__illustration {
  display: block;
  width: 100%;
  height: 100%;
  object-fit: cover;
}
</style>
