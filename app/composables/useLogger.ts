export const useLogger = () => {
  const isEnabled = () => {
    return (
      process.env.NODE_ENV === "development" ||
      localStorage.getItem("debug") === "true"
    );
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
