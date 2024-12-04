<template>
  <template v-if="state === STATE.USER_ENTERED">
    <div class="flex items-center justify-center gap-8 p-4">
      <p>{{ user?.email }}</p>
      <PGButton variant="ghost" @click="logout">Logout</PGButton>
    </div>
    <div class="flex flex-1 items-center justify-center">
      <NuxtLink class="block text-center underline" to="/guides"
        >Go to guides pages
      </NuxtLink>
    </div>
  </template>

  <template v-else-if="state === STATE.USER_NOT_ENTERED">
    <div class="flex h-dvh w-full justify-center align-middle">
      <PGAuthForm />
    </div>
  </template>
</template>

<script lang="ts" setup>
import { getAuth, onAuthStateChanged, signOut } from "firebase/auth";
import type { TypeFrom } from "~/types";
import { definePageMeta } from "#imports";

definePageMeta({
  title: "Personal Guide Main Page",
});

const STATE = {
  INITIAL: "INITIAL",
  USER_ENTERED: "USER_ENTERED",
  USER_NOT_ENTERED: "USER_NOT_ENTERED",
} as const;

type TState = TypeFrom<typeof STATE>;

const state = ref<TState>(STATE.INITIAL);

const user = useCurrentUser();
const auth = getAuth();

const guidesStore = useGuidesStore();
const { guidesList: guidesInStore } = storeToRefs(guidesStore);
const { fetchGuidesList } = guidesStore;

const logout = async () => {
  await signOut(auth).catch((e) => console.error("Error when exiting", e));
};

const handleUserLogin = async () => {
  await fetchGuidesList();
};

onMounted(() => {
  onAuthStateChanged(auth, (user) => {
    if (user) {
      state.value = STATE.USER_ENTERED;
      handleUserLogin();
    } else {
      state.value = STATE.USER_NOT_ENTERED;
    }
  });
});
</script>
