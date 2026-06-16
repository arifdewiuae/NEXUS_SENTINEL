/**
 * Race a promise against a timeout. On timeout the returned promise rejects with
 * the error from `onTimeout()`. The timer is always cleared so the event loop is
 * never kept alive by a settled race.
 */
export async function withTimeout<T>(
  work: Promise<T>,
  ms: number,
  onTimeout: () => Error,
): Promise<T> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  const timeout = new Promise<never>((_, reject) => {
    timer = setTimeout(() => reject(onTimeout()), ms);
  });
  try {
    return await Promise.race([work, timeout]);
  } finally {
    if (timer) clearTimeout(timer);
  }
}
