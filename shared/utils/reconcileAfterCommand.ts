/** A command may persist before the rest of its operation fails. */
export async function reconcileAfterCommand<T>(
  task: () => Promise<T>,
  invalidate: () => void,
  reconcile: () => Promise<unknown>,
): Promise<T> {
  invalidate();
  try {
    return await task();
  } finally {
    // The owner retains a stale marker on read failure. Preserve the task's result/error.
    await reconcile().catch(() => {});
  }
}
