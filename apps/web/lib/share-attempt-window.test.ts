import { describe, expect, it } from "vitest";
import { advanceShareAttemptWindow, SHARE_ATTEMPT_HOUR_MS, SHARE_ATTEMPT_MAX } from "@/lib/share-attempt-window";

const base = {
  max: SHARE_ATTEMPT_MAX,
  hourMs: SHARE_ATTEMPT_HOUR_MS,
};

describe("advanceShareAttemptWindow", () => {
  it("starts a new window when none exists", () => {
    expect(advanceShareAttemptWindow({ now: 1_000, windowStart: null, count: 0, ...base })).toEqual({
      allow: true,
      count: 1,
      windowStart: 1_000,
    });
  });

  it("resets after the hour rolls over", () => {
    const start = 0;
    expect(
      advanceShareAttemptWindow({
        now: start + SHARE_ATTEMPT_HOUR_MS,
        windowStart: start,
        count: SHARE_ATTEMPT_MAX,
        ...base,
      }),
    ).toEqual({ allow: true, count: 1, windowStart: start + SHARE_ATTEMPT_HOUR_MS });
  });

  it("increments inside the window until max", () => {
    const windowStart = 5_000;
    const at29 = advanceShareAttemptWindow({ now: 5_100, windowStart, count: 28, ...base });
    expect(at29).toEqual({ allow: true, count: 29, windowStart });
    const at30 = advanceShareAttemptWindow({ now: 5_200, windowStart, count: 29, ...base });
    expect(at30).toEqual({ allow: true, count: 30, windowStart });
    const at31 = advanceShareAttemptWindow({ now: 5_300, windowStart, count: 30, ...base });
    expect(at31).toEqual({ allow: false, count: 31, windowStart });
  });

  it("treats a window one ms short of expiry as still active", () => {
    const windowStart = 0;
    const now = windowStart + SHARE_ATTEMPT_HOUR_MS - 1;
    expect(advanceShareAttemptWindow({ now, windowStart, count: 2, ...base })).toEqual({
      allow: true,
      count: 3,
      windowStart,
    });
  });
});
