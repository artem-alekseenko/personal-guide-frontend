<template>
  <template v-if="state === STATE.USER_ENTERED">
    <div class="flex items-center justify-center gap-8 p-4">
      <p>{{ user?.email }}</p>
      <UButton variant="ghost" @click="logout">Logout</UButton>
    </div>
  </template>
  <template v-if="state === STATE.USER_NOT_ENTERED">
    <div class="flex h-dvh w-full justify-center align-middle">
      <PGAuthForm />
    </div>
  </template>
  <template v-if="state === STATE.USER_ENTERED">
    <div class="flex flex-1 items-center justify-center">
      <NuxtLink class="block text-center underline" to="/guides"
        >Go to guides pages
      </NuxtLink>
    </div>
  </template>
</template>

<script lang="ts" setup>
import { getAuth, onAuthStateChanged, signOut } from "firebase/auth";
import { definePageMeta } from "#imports";

definePageMeta({
  title: "Personal Guide Main Page",
});

enum STATE {
  INITIAL = "INITIAL",
  USER_ENTERED = "USER_ENTERED",
  USER_NOT_ENTERED = "USER_NOT_ENTERED",
}

const state = ref(STATE.INITIAL);

const user = useCurrentUser();
const auth = getAuth();

const logout = async () => {
  try {
    await signOut(auth);
  } catch (error) {
    console.error("Error when exiting", error);
  }
};

onMounted(() => {
  onAuthStateChanged(auth, (user) => {
    if (user) {
      state.value = STATE.USER_ENTERED;
    } else {
      state.value = STATE.USER_NOT_ENTERED;
    }
  });
});
</script>
