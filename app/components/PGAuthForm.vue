<template>
  <div class="p-10 px-4">
    <div class="flex flex-col gap-6 max-w-md mx-auto">
      <!-- Social auth (primary) -->
      <PGAuthSocialButtons
        :providers="socialProviders"
        :disabled="isFormLoading"
        class="w-full"
        @error="onSocialError"
      />

      <div class="flex items-center gap-4">
        <div class="flex-1 h-px bg-gray-300" />
        <span class="text-sm text-gray-500">{{ $t("auth.orSignInWithEmail") }}</span>
        <div class="flex-1 h-px bg-gray-300" />
      </div>

      <!-- Email/password form -->
      <form class="flex flex-col gap-4" @submit.prevent="handleEmailSubmit">
        <UInput
          v-model="email"
          :disabled="isFormLoading"
          :placeholder="$t('auth.email')"
          class="w-full"
          required
          type="email"
          variant="outline"
        />
        <UInput
          v-model="password"
          :disabled="isFormLoading"
          :placeholder="$t('auth.password')"
          class="w-full"
          required
          type="password"
          variant="outline"
        />
        <UInput
          v-if="mode === MODE.REGISTER"
          v-model="passwordConfirm"
          :disabled="isFormLoading"
          :placeholder="$t('auth.passwordConfirm')"
          class="w-full"
          required
          type="password"
          variant="outline"
        />

        <p v-if="formError" class="text-sm text-red-600">{{ formError }}</p>

        <div class="flex flex-col gap-3">
          <PGButton
            :loading="isFormLoading"
            block
            type="submit"
            variant="outline"
          >
            {{ mode === MODE.LOGIN ? $t("auth.login") : $t("auth.register") }}
          </PGButton>
          <button
            :disabled="isFormLoading"
            class="text-sm text-primary-600 underline underline-offset-2 cursor-pointer p-0 bg-transparent border-0 hover:text-primary-700 disabled:cursor-not-allowed disabled:opacity-75 disabled:no-underline"
            type="button"
            @click="toggleMode"
          >
            {{ mode === MODE.LOGIN ? $t("auth.noAccountRegister") : $t("auth.hasAccountLogin") }}
          </button>
        </div>
      </form>
    </div>
  </div>
</template>

<script lang="ts" setup>
import type { AuthErrorCode } from "~/composables/useAuthActions";
import { useAuthActions } from "~/composables/useAuthActions";
import type { TypeFrom } from "~/types";

const MODE = {
  LOGIN: "LOGIN",
  REGISTER: "REGISTER",
} as const;

const STATE = {
  INITIAL: "INITIAL",
  REQUESTING_USER: "REQUESTING_USER",
  USER_FOUND: "USER_FOUND",
  ERROR_REQUEST: "ERROR_REQUEST",
} as const;

type TMode = TypeFrom<typeof MODE>;
type TState = TypeFrom<typeof STATE>;

const { loginWithEmail, registerWithEmail } = useAuthActions();

const mode = ref<TMode>(MODE.LOGIN);
const state = ref<TState>(STATE.INITIAL);
const email = ref("");
const password = ref("");
const passwordConfirm = ref("");
const formError = ref("");

const { t } = useI18n();

const isFormLoading = computed(() => state.value === STATE.REQUESTING_USER);

const socialProviders = computed(() => [
  { id: "google" as const, label: t("auth.continueWithGoogle"), icon: "i-logos-google-icon" },
]);

const toggleMode = () => {
  mode.value = mode.value === MODE.LOGIN ? MODE.REGISTER : MODE.LOGIN;
  formError.value = "";
  passwordConfirm.value = "";
  state.value = STATE.INITIAL;
};

const errorKeyMap: Partial<Record<AuthErrorCode, string>> = {
  "auth/invalid-email": "auth.errors.invalidEmail",
  "auth/user-disabled": "auth.errors.userDisabled",
  "auth/user-not-found": "auth.errors.userNotFound",
  "auth/wrong-password": "auth.errors.wrongPassword",
  "auth/email-already-in-use": "auth.errors.emailAlreadyInUse",
  "auth/weak-password": "auth.errors.weakPassword",
  "auth/invalid-credential": "auth.errors.invalidCredential",
  "auth/popup-closed-by-user": "auth.errors.popupClosed",
  "auth/cancelled-popup-request": "auth.errors.popupClosed",
  "auth/popup-blocked": "auth.errors.popupBlocked",
  "auth/account-exists-with-different-credential": "auth.errors.accountExistsDifferentCredential",
};

const getErrorMessage = (code: AuthErrorCode): string =>
  t(errorKeyMap[code] ?? "auth.loginError");

const isAuthErrorCode = (c: string): c is AuthErrorCode => c.startsWith("auth/");

const handleEmailSubmit = async () => {
  formError.value = "";

  if (mode.value === MODE.REGISTER) {
    if (password.value !== passwordConfirm.value) {
      formError.value = t("auth.errors.passwordMismatch");
      return;
    }
    if (password.value.length < 6) {
      formError.value = t("auth.errors.weakPassword");
      return;
    }
  }

  state.value = STATE.REQUESTING_USER;

  const result =
    mode.value === MODE.LOGIN
      ? await loginWithEmail(email.value, password.value)
      : await registerWithEmail(email.value, password.value);

  if (result.success) {
    state.value = STATE.USER_FOUND;
    return;
  }

  state.value = STATE.ERROR_REQUEST;
  formError.value = result.errorCode
    ? getErrorMessage(result.errorCode)
    : t("auth.loginError");
};

const onSocialError = (code: string) => {
  formError.value = isAuthErrorCode(code) ? getErrorMessage(code) : t("auth.loginError");
};
</script>
