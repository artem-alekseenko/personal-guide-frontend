<template>
  <!-- <PGTourCard> -->
  <div
    :style="{ backgroundImage: `url(${imageUrl})` }"
    class="lg:grid-row-3 relative grid grid-cols-1 items-center justify-start justify-items-center gap-x-16 gap-y-4 rounded-xl border border-solid border-lime-200 bg-cover bg-center p-4 shadow-xl hover:border-neutral-200 hover:bg-neutral-100 md:p-8 lg:w-full lg:grid-cols-4"
  >
    <div class="absolute inset-0 rounded-xl bg-black bg-black/50"></div>
    <div class="relative z-10">
      <h2 class="prose text-xl font-bold text-white">{{ name }}</h2>
      <p class="prose text-lg font-semibold text-slate-100">
        {{ description }}
      </p>
      <p class="text-slate-100">Guide: {{ guideName }}</p>
      <p v-if="generatingPercent !== 100" class="prose">
        <UProgress :value="generatingPercent" indicator />
      </p>
      <p class="prose text-green-200">{{ generatingText }}</p>
      <NuxtLink
        v-if="generatingPercent === 100"
        :to="`/tours/${tourId}`"
        class="prose block text-right text-blue-100 underline"
      >
        Go to the tour
      </NuxtLink>
    </div>
  </div>
</template>

<script lang="ts" setup>
defineProps<{
  name: string;
  description: string;
  generatingPercent: number;
  generatingText: string;
  tourId: string;
  imageUrl: string;
  guideName: string;
}>();
</script>
