<template>
  <!-- <PGGuide> -->
  <div
    class="lg:grid-row-3 grid grid-cols-1 items-center justify-start justify-items-center gap-x-16 gap-y-4 rounded-xl border border-solid border-lime-200 p-4 shadow-xl hover:border-gray-200 hover:bg-gray-100 md:p-8 lg:w-full lg:grid-cols-4"
  >
    <UAvatar :alt="guide.name" :src="guide.avatar" size="4xl" />
    <div class="flex-col gap-8 text-center lg:col-span-2 lg:flex">
      <h2 class="font-bold uppercase lg:text-4xl">{{ guide.name }}</h2>
      <div class="text-pretty pb-4 text-center">{{ guide.context }}</div>
    </div>
    <div class="pb-4">
      <span class="font-bold">Skills:</span>
      {{ guide.skills }}
    </div>
    <UButton @click="selectGuide"
      >Select {{ guide.name }} and create tour</UButton
    >
    <div class="col-span-full justify-self-start pb-2 text-lg font-bold">
      Past tours:
    </div>
    <div class="col-span-full w-full gap-8 lg:flex">
      <div
        v-for="tour in guide.tours"
        :key="tour.id"
        class="grid grid-cols-1 gap-y-2 lg:min-w-[400px] lg:max-w-[400px]"
      >
        <div>
          <img
            :src="tour.image"
            alt="tour"
            class="lg:max-h-54 h-full max-h-60 w-full rounded-xl object-cover"
          />
        </div>
        <h3 class="prose font-bold">{{ tour.name }}</h3>
        <div class="prose">{{ tour.description }}</div>
      </div>
    </div>
  </div>
  <!-- </PGGuide> -->
</template>

<script lang="ts" setup>
import type { Guide } from "~/types/guides";
import { useSelectedGuide } from "~/stores/selectedGuideStore";

interface Props {
  guide: Guide;
}

const props = defineProps<Props>();

const router = useRouter();

let guide = ref(props.guide);

const selectedGuideStore = useSelectedGuide();

const selectGuide = () => {
  const { setGuide } = selectedGuideStore;
  setGuide(guide.value);

  router.push({ name: "create-route" });
};
</script>
