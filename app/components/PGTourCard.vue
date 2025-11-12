  <template>
  <!-- <PGTourCard> -->
  <div
    :style="{ backgroundImage: `url(${imageUrl})` }"
    class="lg:grid-row-3 relative grid grid-cols-1 items-center justify-start justify-items-center gap-x-16 gap-y-4 rounded-xl border border-solid border-lime-200 bg-cover bg-center p-4 shadow-xl hover:border-neutral-200 hover:bg-neutral-100 md:p-8 lg:w-full lg:grid-cols-4"
  >
    <div class="absolute inset-0 rounded-xl bg-black bg-black/70"></div>
    <div class="relative z-10">
      <h2 class="prose text-2xl font-bold text-white">{{ name }}</h2>
      <div class="relative">
        <p 
          ref="descriptionRef"
          :class="[
            'prose text-base font-semibold text-slate-100 transition-all duration-300',
            isExpanded ? '' : 'line-clamp-5'
          ]"
        >
          {{ description }}
        </p>
        <button
          v-if="shouldShowToggle"
          @click="toggleExpanded"
          class="ml-auto block mt-2 text-sm text-blue-200 hover:text-blue-100 underline focus:outline-none focus:ring-2 focus:ring-blue-300 focus:ring-opacity-50 rounded transition-colors duration-200"
        >
          {{ isExpanded ? $t('components.tourCard.showLess') : $t('components.tourCard.showMore') }}
        </button>
      </div>
      <p class="text-slate-100">{{ $t('components.tourCard.guide') }} {{ guideName }}</p>
      <p v-if="generatingPercent !== 100" class="prose">
        <UProgress :value="generatingPercent" indicator />
      </p>
      <p class="prose text-green-200">{{ generatingText }}</p>
      <NuxtLink
        v-if="generatingPercent === 100"
        :to="`/tours/${tourId}`"
        class="prose block text-right text-blue-100 underline"
      >
        {{ $t('navigation.goToTour') }}
      </NuxtLink>
    </div>
  </div>
</template>

<script lang="ts" setup>
import { ref, onMounted, nextTick, toRefs } from 'vue';

const props = defineProps<{
  name: string;
  description: string;
  generatingPercent: number;
  generatingText: string;
  tourId: string;
  imageUrl: string;
  guideName: string;
}>();

const { name, description, generatingPercent, generatingText, tourId, imageUrl, guideName } = toRefs(props);

const isExpanded = ref(false);
const shouldShowToggle = ref(false);
const descriptionRef = ref<HTMLParagraphElement | null>(null);

const toggleExpanded = () => {
  isExpanded.value = !isExpanded.value;
};

// Check if description is long enough to warrant a toggle button
onMounted(async () => {
  await nextTick();
  
  if (!descriptionRef.value) return;
  
  // Temporarily remove the line-clamp to measure full height
  const element = descriptionRef.value;
  const originalClassName = element.className;
  
  // Remove line-clamp temporarily to get full height
  element.className = element.className.replace('line-clamp-5', '');
  
  // Get the full height and line height
  const fullHeight = element.scrollHeight;
  const computedStyle = getComputedStyle(element);
  const lineHeight = parseInt(computedStyle.lineHeight) || 24;
  
  // Restore original className
  element.className = originalClassName;
  
  // Check if content exceeds 5 lines
  const maxHeight = lineHeight * 5;
  shouldShowToggle.value = fullHeight > maxHeight;
});
</script>
