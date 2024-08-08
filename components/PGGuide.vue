<template>
  <div
      class="grid grid-cols-1 lg:grid-cols-4 lg:grid-row-3 gap-y-4 gap-x-16 justify-items-center lg:w-full items-center justify-start rounded-xl border border-solid border-lime-200 p-4 md:p-8
        hover:bg-gray-100 hover:border-gray-200 shadow-xl"
  >
    <div
        class="flex h-32 w-32 items-center justify-center overflow-hidden rounded-full bg-white md:h-40 md:w-40 lg:h-52 lg:w-52"
    >
      <img
          :src="guide.avatar"
          alt="Guides avatar"
          class="h-full w-full object-cover"
      />
    </div>
    <div class="lg:col-span-2 lg:flex flex-col gap-8 text-center">
      <h2 class="font-bold uppercase lg:text-4xl">{{ guide.name }}</h2>
      <div class="text-pretty pb-4 text-center">{{ guide.context }}</div>
    </div>
    <div class="pb-4">
      <span class="font-bold">Skills:</span>
      {{ guide.skills }}
    </div>
    <div class="font-bold text-lg pb-2 col-span-full justify-self-start">Past tours:</div>
    <div class="w-full col-span-full lg:flex gap-8">
      <div
          v-for="tour in guide.tours"
          :key="tour.id"
          class="grid grid-cols-1 gap-y-2 lg:max-w-[400px] lg:min-w-[400px]">
        <div>
          <img
              :src="tour.image"
              alt="tour"
              class="h-full w-full rounded-xl object-cover max-h-60 lg:max-h-54"
          />
        </div>
        <h3 class="prose font-bold">{{ tour.name }}</h3>
        <div class="prose">{{ tour.description }}</div>
      </div>
    </div>
  </div>
</template>

<script lang="ts" setup>
import type {Guide} from "~/types/guides";
import {ref} from "#imports";

interface Props {
  guide: Guide;
}

const props = defineProps<Props>();

let guide = ref<Guide>(props.guide);
</script>

<style scoped>
.guide__avatar {
  width: 100px;
}

.guide_img {
  width: 100%;
}
</style>
