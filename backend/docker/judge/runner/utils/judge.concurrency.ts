/**
  * Resolves worker concurrency from environment variable JUDGE_CONCURRENCY.
  * Accepts only positive safe integers; defaults to 1.
  */
export function resolveConcurrency(
  raw: string | undefined,
  onInvalid?: (suppliedValue: string) => void,
): number {
  const FALLBACK = 1;

  if (raw === undefined) {
    return FALLBACK;
  }

  const trimmed = raw.trim();

  if (!/^\d+$/.test(trimmed)) {
    onInvalid?.(raw);
    return FALLBACK;
  }

  const parsed = Number(trimmed);

  if (!Number.isSafeInteger(parsed) || parsed < 1) {
    onInvalid?.(raw);
    return FALLBACK;
  }

  return parsed;
}
