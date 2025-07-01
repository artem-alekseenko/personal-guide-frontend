<template>
  <!-- <PGGuide> -->
  <div
    class="lg:grid-row-3 grid grid-cols-1 items-center justify-start justify-items-center gap-x-16 gap-y-4 rounded-xl border border-solid border-lime-200 p-4 shadow-xl hover:border-neutral-200 hover:bg-neutral-100 md:p-8 lg:w-full lg:grid-cols-4"
  >
    <div 
      v-if="!guide.avatar"
      class="h-24 w-24 rounded-full bg-slate-200 flex items-center justify-center"
    >
      <span class="text-3xl font-bold text-gray-600">
        {{ guide.name?.charAt(0).toUpperCase() }}
      </span>
    </div>
    <UAvatar v-else :alt="guide.name" :src="guide.avatar" size="3xl" />
    <div class="flex-col gap-8 text-center lg:col-span-2 lg:flex">
      <h2 class="font-bold uppercase lg:text-4xl">{{ guide.name }}</h2>
      <div class="pb-4 text-center text-pretty">{{ guide.context }}</div>
    </div>
    <div class="pb-4">
      <span class="font-bold">{{ $t('components.guide.skills') }}</span>
      {{ guide.skills }}
    </div>
    <PGButton @click="selectGuide">
      {{ $t('pages.createRoute.selectGuideAndCreate', { name: guide.name }) }}
    </PGButton>
    <div class="col-span-full w-full gap-8 lg:flex">
      <div
        v-for="tour in guide.tours"
        :key="tour.id"
        class="grid grid-cols-1 gap-y-2 lg:max-w-[400px] lg:min-w-[400px]"
      >
        <div>
          <img
            :src="tour.image"
            alt="tour"
            class="h-full max-h-60 w-full rounded-xl object-cover lg:max-h-54"
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
import type { IGuide } from "~/types";
import { useGuidesStore } from "~/stores/guidesStore";

interface Props {
  guide: IGuide;
}

const props = defineProps<Props>();

const router = useRouter();

let guide = ref(props.guide);

const guidesStore = useGuidesStore();

const selectGuide = () => {
  guidesStore.setSelectedGuide(guide.value);

  router.push({ name: "create-route" });
};
</script>
