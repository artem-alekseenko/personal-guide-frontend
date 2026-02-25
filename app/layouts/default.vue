<template>
  <div class="default-layout">
    <AppHeader />
    <main class="default-layout__main">
      <slot />
    </main>
    <PGButton v-if="isAuthenticated" variant="ghost" @click="logout">
      {{ $t("common.logout") }}
    </PGButton>
  </div>
</template>

<script lang="ts" setup>
import { getAuth, signOut } from "firebase/auth";
import { useAuth } from "~/composables/useAuth";

const auth = getAuth();
const { isAuthenticated } = useAuth();
const router = useRouter();

const logout = async () => {
  await signOut(auth).catch((e) => console.error("Error when exiting", e));
  router.push({ name: "index" });
};
</script>

<style scoped>
.default-layout {
  display: flex;
  flex-direction: column;
  align-items: center;
  width: 100%;
  height: 100%;
  min-height: 100vh;
}

.default-layout__main {
  width: 100%;
  container: main / inline-size;
  display: flex;
  flex: 1 1 0;
  flex-direction: column;
  align-items: center;
}
</style>
