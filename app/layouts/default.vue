<template>
  <div class="flex h-full min-h-screen w-full flex-col">
    <AppHeader />
    <main class="flex flex-1 flex-col items-center">
      <slot />
    </main>
    <PGButton class="mx-auto mt-auto" variant="ghost" @click="logout"
      >Logout</PGButton
    >
  </div>
</template>

<script lang="ts" setup>
import { getAuth, signOut } from "firebase/auth";

const auth = getAuth();
const router = useRouter();

const logout = async () => {
  await signOut(auth).catch((e) => console.error("Error when exiting", e));
  router.push({ name: "index" });
};
</script>
