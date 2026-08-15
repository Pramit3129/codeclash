/**
 * JUDGE_CONCURRENCY parsing.
 *
 * Lives in its own module purely so it can be unit tested: importing
 * judge.worker.ts constructs a BullMQ Worker, a PrismaClient and a Redis
 * connection at module scope, so a test that imported it would attach a
 * live worker to whatever REDIS_URL is configured.
 *
 * The warning is injected rather than imported for the same reason —
 * the shared logger pulls in config/env.ts, which calls process.exit(1)
 * when the full production environment is not present.
 */

/**
 * Resolves the worker concurrency from a raw environment value.
 *
 * Accepts ONLY a positive integer. Everything else falls back to 1.
 *
 * Why this is strict rather than a plain `Number(... ?? "1")`:
 *
 *   - `??` only substitutes for `undefined`, so a present-but-empty
 *     variable (`JUDGE_CONCURRENCY=`) slips through and `Number("")`
 *     is 0.
 *   - BullMQ accepts `concurrency: 0`, reports the worker ready, and
 *     holds a healthy Redis connection while consuming NOTHING. Jobs
 *     pile up in QUEUED with no error anywhere.
 *   - Deployment templates such as `${JUDGE_CONCURRENCY:-1}` produce
 *     exactly that empty value when the variable is absent from the
 *     environment file.
 *
 * `Number.parseInt` is deliberately avoided: it truncates, so "2.7"
 * would be accepted as 2. A decimal is a misconfiguration and must fall
 * back rather than be silently rounded.
 *
 * @param raw       Raw env value, or undefined when unset.
 * @param onInvalid Called only when a value was supplied and rejected,
 *                  so an unset variable stays silent.
 */
export function resolveConcurrency(
  raw: string | undefined,
  onInvalid?: (suppliedValue: string) => void,
): number {
  const FALLBACK = 1;

  /*
   * Unset is the normal default, not a misconfiguration.
   */
  if (raw === undefined) {
    return FALLBACK;
  }

  const trimmed = raw.trim();

  /*
   * Digits only. Rejects "", " ", "abc", "-1", "1.5", "1e3", "+2".
   */
  if (!/^\d+$/.test(trimmed)) {
    onInvalid?.(raw);
    return FALLBACK;
  }

  const parsed = Number(trimmed);

  /*
   * Rejects "0" and anything beyond exact integer precision.
   */
  if (!Number.isSafeInteger(parsed) || parsed < 1) {
    onInvalid?.(raw);
    return FALLBACK;
  }

  return parsed;
}
