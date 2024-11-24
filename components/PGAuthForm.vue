<template>
  <div class="container flex max-w-md flex-col justify-center gap-4 p-10">
    <UInput
      v-model="email"
      class="block"
      placeholder="Email"
      type="email"
      variant="outline"
    />
    <UInput
      v-model="password"
      class="block"
      placeholder="Password"
      type="password"
      variant="outline"
    />
    <PGButton
      :loading="state === STATE.REQUESTING_USER"
      block
      variant="outline"
      @click="login"
      >Login</PGButton
    >
  </div>
</template>

<script lang="ts" setup>
import { getAuth, signInWithEmailAndPassword } from "firebase/auth";

enum STATE {
  INITIAL = "INITIAL",
  REQUESTING_USER = "REQUESTING_USER",
  USER_FOUND = "USER_FOUND",
  ERROR_REQUEST = "ERROR_REQUEST",
}

const state = ref(STATE.INITIAL);
const email = ref("");
const password = ref("");

const auth = getAuth();

const login = async () => {
  state.value = STATE.REQUESTING_USER;

  try {
    const userCredential = await signInWithEmailAndPassword(
      auth,
      email.value,
      password.value,
    );
    console.log("userCredential", userCredential);
    state.value = STATE.USER_FOUND;
  } catch (error: any) {
    console.log(error);
    state.value = STATE.ERROR_REQUEST;
  }
};
</script>
