<template>
  <div class="container flex max-w-md flex-col justify-center gap-4 p-10">
    <UInput
      v-model="email"
      class="block"
      :placeholder="$t('auth.email')"
      type="email"
      variant="outline"
    />
    <UInput
      v-model="password"
      class="block"
      :placeholder="$t('auth.password')"
      type="password"
      variant="outline"
    />
    <PGButton
      :loading="state === STATE.REQUESTING_USER"
      block
      variant="outline"
      @click="login"
      >{{ $t('auth.login') }}</PGButton
    >
  </div>
</template>

<script lang="ts" setup>
import { getAuth, signInWithEmailAndPassword } from "firebase/auth";
import type { TypeFrom } from "~/types";

const STATE = {
  INITIAL: "INITIAL",
  REQUESTING_USER: "REQUESTING_USER",
  USER_FOUND: "USER_FOUND",
  ERROR_REQUEST: "ERROR_REQUEST",
} as const;

type TState = TypeFrom<typeof STATE>;

const state = ref<TState>(STATE.INITIAL);
const email = ref("");
const password = ref("");

const auth = getAuth();

const login = async () => {
  state.value = STATE.REQUESTING_USER;

  const authResponse = await signInWithEmailAndPassword(
    auth,
    email.value,
    password.value,
  ).catch((e) => e as Error);

  if (authResponse instanceof Error) {
    console.error(authResponse.message);
    state.value = STATE.ERROR_REQUEST;

    return;
  }

  state.value = STATE.USER_FOUND;
};
</script>
