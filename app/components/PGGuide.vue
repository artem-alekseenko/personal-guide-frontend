<template>
  <div class="pg-guide">
    <div v-if="!guide.avatar" class="pg-guide__avatar-placeholder">
      <span class="pg-guide__initial">
        {{ guide.name?.charAt(0).toUpperCase() }}
      </span>
    </div>
    <UAvatar v-else :alt="guide.name" :src="guide.avatar" size="3xl" />
    <div class="pg-guide__header">
      <h2 class="pg-guide__name">{{ guide.name }}</h2>
      <div class="pg-guide__context">{{ guide.context }}</div>
    </div>
    <div class="pg-guide__skills">
      <span class="pg-guide__skills-label">
        {{ $t("components.guide.skills") }}
      </span>
      {{ guide.skills }}
    </div>
    <PGButton @click="selectGuide">
      {{ $t("pages.createRoute.selectGuideAndCreate", { name: guide.name }) }}
    </PGButton>
    <div class="pg-guide__tours">
      <div v-for="tour in guide.tours" :key="tour.id" class="pg-guide__tour">
        <div class="pg-guide__tour-image-wrap">
          <img :src="tour.image" alt="tour" class="pg-guide__tour-image" />
        </div>
        <h3 class="pg-guide__tour-name">{{ tour.name }}</h3>
        <div class="pg-guide__tour-description">{{ tour.description }}</div>
      </div>
    </div>
  </div>
</template>

<script lang="ts" setup>
import type { IGuide } from "~/types";
import { useGuidesStore } from "~/stores/guidesStore";

interface Props {
  guide: IGuide;
}

const { guide } = defineProps<Props>();

const router = useRouter();

const guidesStore = useGuidesStore();

const selectGuide = () => {
  guidesStore.setSelectedGuide(guide);

  router.push("/create-route");
};
</script>

<style scoped>
.pg-guide {
  display: grid;
  grid-template-columns: 1fr;
  align-items: center;
  justify-items: center;
  column-gap: 4rem;
  row-gap: 1rem;
  padding: 1rem;
  border: 1px solid var(--fill-lime-200);
  border-radius: 0.75rem;
  box-shadow:
    0 1.25rem 1.5625rem -0.3125rem oklch(0 0 0 / 0.1),
    0 0.5rem 0.625rem -0.375rem oklch(0 0 0 / 0.1);
  transition:
    border-color 0.15s,
    background-color 0.15s;
}

.pg-guide:hover {
  border-color: var(--fill-neutral-200);
  background-color: var(--fill-neutral-100);
}

.pg-guide__avatar-placeholder {
  display: flex;
  height: 6rem;
  width: 6rem;
  align-items: center;
  justify-content: center;
  border-radius: 9999px;
  background-color: var(--fill-slate-200);
}

.pg-guide__initial {
  font-size: 1.875rem;
  font-weight: 700;
  color: var(--fill-gray-600);
}

.pg-guide__header {
  display: flex;
  flex-direction: column;
  gap: 2rem;
  text-align: center;
}

.pg-guide__name {
  font-weight: 700;
  text-transform: uppercase;
}

.pg-guide__context {
  padding-block-end: 1rem;
  text-align: center;
  text-wrap: pretty;
}

.pg-guide__skills {
  padding-block-end: 1rem;
}

.pg-guide__skills-label {
  font-weight: 700;
}

.pg-guide__tours {
  grid-column: 1 / -1;
  width: 100%;
  display: flex;
  flex-direction: column;
  gap: 2rem;
}

.pg-guide__tour {
  display: grid;
  grid-template-columns: 1fr;
  row-gap: 0.5rem;
}

.pg-guide__tour-image {
  height: 100%;
  width: 100%;
  max-height: 15rem;
  border-radius: 0.75rem;
  object-fit: cover;
}

.pg-guide__tour-name {
  font-weight: 700;
  font-size: 1.25em;
  line-height: 1.75;
  margin: 0;
}

.pg-guide__tour-description {
  font-size: 1rem;
  line-height: 1.75;
}
</style>
