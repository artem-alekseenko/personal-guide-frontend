import {
  getAuth,
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  signInWithPopup,
  GoogleAuthProvider,
} from "firebase/auth";

export type AuthErrorCode =
  | "auth/invalid-email"
  | "auth/user-disabled"
  | "auth/user-not-found"
  | "auth/wrong-password"
  | "auth/email-already-in-use"
  | "auth/weak-password"
  | "auth/invalid-credential"
  | "auth/popup-closed-by-user"
  | "auth/popup-blocked"
  | "auth/cancelled-popup-request"
  | "auth/account-exists-with-different-credential"
  | string;

export interface AuthActionResult {
  success: boolean;
  errorCode?: AuthErrorCode;
  errorMessage?: string;
}

export const useAuthActions = () => {
  const auth = getAuth();
  const route = useRoute();

  const getNextPath = (): string => {
    const nextParam = (route.query.next as string) || "/tours";
    return typeof nextParam === "string" && nextParam.startsWith("/")
      ? nextParam
      : "/tours";
  };

  const navigateAfterAuth = () => {
    const next = getNextPath();
    navigateTo(next, { replace: true });
  };

  const loginWithEmail = async (
    email: string,
    password: string
  ): Promise<AuthActionResult> => {
    try {
      await signInWithEmailAndPassword(auth, email, password);
      navigateAfterAuth();
      return { success: true };
    } catch (e) {
      const err = e as { code?: string; message?: string };
      return {
        success: false,
        errorCode: err.code as AuthErrorCode,
        errorMessage: err.message,
      };
    }
  };

  const registerWithEmail = async (
    email: string,
    password: string
  ): Promise<AuthActionResult> => {
    try {
      await createUserWithEmailAndPassword(auth, email, password);
      navigateAfterAuth();
      return { success: true };
    } catch (e) {
      const err = e as { code?: string; message?: string };
      return {
        success: false,
        errorCode: err.code as AuthErrorCode,
        errorMessage: err.message,
      };
    }
  };

  const loginWithGoogle = async (): Promise<AuthActionResult> => {
    try {
      const provider = new GoogleAuthProvider();
      await signInWithPopup(auth, provider);
      navigateAfterAuth();
      return { success: true };
    } catch (e) {
      const err = e as { code?: string; message?: string };
      return {
        success: false,
        errorCode: err.code as AuthErrorCode,
        errorMessage: err.message,
      };
    }
  };

  return {
    loginWithEmail,
    registerWithEmail,
    loginWithGoogle,
  };
};
