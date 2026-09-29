export const useLogger = () => {
  const isEnabled = () => {
    if (import.meta.dev) return true;
    try {
      return (
        typeof localStorage !== "undefined" &&
        localStorage.getItem("debug") === "true"
      );
    } catch {
      return false;
    }
  };

  const log = (...args: unknown[]) => {
    if (isEnabled()) {
      console.log("[LOG]", ...args);
    }
  };

  const warn = (...args: unknown[]) => {
    if (isEnabled()) {
      console.warn("[WARN]", ...args);
    }
  };

  const error = (...args: unknown[]) => {
    if (isEnabled()) {
      console.error("[ERROR]", ...args);
    }
  };

  return {
    log,
    warn,
    error,
  };
};
