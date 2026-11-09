export const SHARE_ATTEMPT_MAX = 30;
export const SHARE_ATTEMPT_HOUR_MS = 60 * 60 * 1000;

export type ShareAttemptWindowInput = {
  now: number;
  windowStart: number | null;
  count: number;
  max: number;
  hourMs: number;
};

export type ShareAttemptWindowResult = {
  allow: boolean;
  count: number;
  windowStart: number;
};

/** Rolling-hour counter for public approve/decline attempts on one share token. */
export function advanceShareAttemptWindow(input: ShareAttemptWindowInput): ShareAttemptWindowResult {
  const { now, windowStart, count, max, hourMs } = input;
  const expired = windowStart == null || now - windowStart >= hourMs;
  if (expired) {
    return { allow: 1 <= max, count: 1, windowStart: now };
  }
  const nextCount = count + 1;
  return { allow: nextCount <= max, count: nextCount, windowStart };
}
