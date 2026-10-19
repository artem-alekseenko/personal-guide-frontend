import { getApp, getApps, initializeApp } from "firebase/app";
import {
  initializeAppCheck,
  ReCaptchaEnterpriseProvider,
} from "firebase/app-check";
import { getAuth, onAuthStateChanged } from "firebase/auth";
import { shallowReadonly, shallowRef } from "vue";

export default defineNuxtPlugin({
  name: "firebase-auth",
  enforce: "pre",
  setup(nuxtApp) {
    const config = useRuntimeConfig().public;
    const app = getApps().length ? getApp() : initializeApp(config.firebase);
    if (config.firebaseAppCheckSiteKey) {
      if (import.meta.dev)
        Object.assign(globalThis, { FIREBASE_APPCHECK_DEBUG_TOKEN: true });
      initializeAppCheck(app, {
        provider: new ReCaptchaEnterpriseProvider(
          config.firebaseAppCheckSiteKey,
        ),
        isTokenAutoRefreshEnabled: true,
      });
    }

    const auth = getAuth(app);
    const user = shallowRef(auth.currentUser);
    const unsubscribe = onAuthStateChanged(auth, (current) => {
      user.value = current;
    });
    nuxtApp.vueApp.onUnmount(unsubscribe);
    if (import.meta.hot) import.meta.hot.dispose(unsubscribe);

    return { provide: { firebaseUser: shallowReadonly(user) } };
  },
});
