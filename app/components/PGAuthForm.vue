<template>
  <div class="p-10 px-4">
    <div class="mx-auto flex max-w-md flex-col gap-6">
      <!-- Social auth (primary) -->
      <PGAuthSocialButtons
        :providers="socialProviders"
        :disabled="isFormLoading"
        class="w-full"
        @error="onSocialError"
      />

      <div class="flex items-center gap-4">
        <div class="h-px flex-1 bg-gray-300" />
        <span class="text-sm text-gray-500">{{
          $t("auth.orSignInWithEmail")
        }}</span>
        <div class="h-px flex-1 bg-gray-300" />
      </div>

      <!-- Email/password form -->
      <form class="flex flex-col gap-4" @submit.prevent="handleEmailSubmit">
        <div class="flex flex-col gap-1">
          <label :for="`auth-email-${formId}`" class="text-sm font-medium">
            {{ $t("auth.email") }}
          </label>
          <UInput
            :id="`auth-email-${formId}`"
            v-model="email"
            :disabled="isFormLoading"
            :placeholder="$t('auth.email')"
            autocomplete="email"
            class="w-full"
            name="email"
            required
            type="email"
            variant="outline"
          />
        </div>
        <div class="flex flex-col gap-1">
          <label :for="`auth-password-${formId}`" class="text-sm font-medium">
            {{ $t("auth.password") }}
          </label>
          <UInput
            :id="`auth-password-${formId}`"
            v-model="password"
            :autocomplete="
              mode === MODE.LOGIN ? 'current-password' : 'new-password'
            "
            :disabled="isFormLoading"
            :placeholder="$t('auth.password')"
            class="w-full"
            name="password"
            required
            type="password"
            variant="outline"
          />
        </div>
        <div v-if="mode === MODE.REGISTER" class="flex flex-col gap-1">
          <label
            :for="`auth-password-confirm-${formId}`"
            class="text-sm font-medium"
          >
            {{ $t("auth.passwordConfirm") }}
          </label>
          <UInput
            :id="`auth-password-confirm-${formId}`"
            v-model="passwordConfirm"
            :disabled="isFormLoading"
            :placeholder="$t('auth.passwordConfirm')"
            autocomplete="new-password"
            class="w-full"
            name="password-confirm"
            required
            type="password"
            variant="outline"
          />
        </div>

        <p
          v-if="formError"
          class="text-sm text-red-700 dark:text-red-300"
          role="alert"
        >
          {{ formError }}
        </p>

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
            class="text-primary-600 hover:text-primary-700 cursor-pointer border-0 bg-transparent p-0 text-sm underline underline-offset-2 disabled:cursor-not-allowed disabled:no-underline disabled:opacity-75"
            type="button"
            @click="toggleMode"
          >
            {{
              mode === MODE.LOGIN
                ? $t("auth.noAccountRegister")
                : $t("auth.hasAccountLogin")
            }}
          </button>
        </div>
      </form>
    </div>
  </div>
</template>

<script lang="ts" setup>
import { useId } from "vue";
import type { AuthErrorCode } from "~/composables/auth/useAuthActions";
import { useAuthActions } from "~/composables/auth/useAuthActions";
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
const formId = useId();

const mode = ref<TMode>(MODE.LOGIN);
const state = ref<TState>(STATE.INITIAL);
const email = ref("");
const password = ref("");
const passwordConfirm = ref("");
const formError = ref("");

const { t } = useI18n();

const isFormLoading = computed(() => state.value === STATE.REQUESTING_USER);

const socialProviders = computed(() => [
  {
    id: "google" as const,
    label: t("auth.continueWithGoogle"),
    icon: "i-logos-google-icon",
  },
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
  "auth/account-exists-with-different-credential":
    "auth.errors.accountExistsDifferentCredential",
  "auth/service-unavailable": "auth.errors.serviceUnavailable",
};

const getErrorMessage = (code: AuthErrorCode): string =>
  t(errorKeyMap[code] ?? "auth.loginError");

const isAuthErrorCode = (c: string): c is AuthErrorCode =>
  c.startsWith("auth/");

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
  formError.value = isAuthErrorCode(code)
    ? getErrorMessage(code)
    : t("auth.errors.serviceUnavailable");
};
</script>
