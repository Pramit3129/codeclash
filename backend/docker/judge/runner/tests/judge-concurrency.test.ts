/**
 * JUDGE_CONCURRENCY parsing.
 *
 * Regression cover for a production incident: a present-but-empty
 * JUDGE_CONCURRENCY produced `Number("") === 0`, and BullMQ ran happily
 * with concurrency 0 — worker reported ready, Redis connection healthy,
 * zero jobs consumed, submissions stuck in QUEUED with no error.
 *
 * Pure unit tests; no Docker, Redis or database required.
 */
import { describe, expect, test } from "bun:test";

import { resolveConcurrency } from "../utils/judge.concurrency.ts";

describe("resolveConcurrency", () => {
  describe("falls back to 1 for anything that is not a positive integer", () => {
    const invalid: [string, string | undefined][] = [
      ["undefined (variable unset)", undefined],
      ["empty string", ""],
      ["whitespace only", " "],
      ["non-numeric", "abc"],
      ["zero", "0"],
      ["negative", "-1"],
      ["decimal", "1.5"],
    ];

    test.each(invalid)("%s -> 1", (_label, raw) => {
      expect(resolveConcurrency(raw)).toBe(1);
    });
  });

  describe("keeps a valid positive integer unchanged", () => {
    const valid: [string, number][] = [
      ["1", 1],
      ["3", 3],
      ["10", 10],
    ];

    test.each(valid)("%s -> %i", (raw, expected) => {
      expect(resolveConcurrency(raw)).toBe(expected);
    });
  });

  describe("decimals are rejected, never truncated", () => {
    /*
     * The earlier Number.parseInt implementation returned 2 here. "1.5"
     * alone could not catch it, because parseInt("1.5") is 1 — which
     * happens to equal the fallback.
     */
    test.each(["2.7", "9.9", "10.1"])("%s -> 1", (raw) => {
      expect(resolveConcurrency(raw)).toBe(1);
    });
  });

  describe("other malformed shapes", () => {
    test.each(["1e3", "+2", "0x2", "1,5", "one", "  3  x", "Infinity", "NaN"])(
      "%s -> 1",
      (raw) => {
        expect(resolveConcurrency(raw)).toBe(1);
      },
    );

    test("surrounding whitespace around a valid value is tolerated", () => {
      expect(resolveConcurrency(" 4 ")).toBe(4);
    });

    test("a value beyond safe integer precision falls back", () => {
      expect(resolveConcurrency("999999999999999999999")).toBe(1);
    });
  });

  describe("warning callback", () => {
    test("is invoked with the offending value when one was supplied", () => {
      const seen: string[] = [];

      for (const raw of ["", " ", "abc", "0", "-1", "1.5"]) {
        resolveConcurrency(raw, (value) => seen.push(value));
      }

      expect(seen).toEqual(["", " ", "abc", "0", "-1", "1.5"]);
    });

    test("stays silent when the variable is simply unset", () => {
      let called = false;

      expect(
        resolveConcurrency(undefined, () => {
          called = true;
        }),
      ).toBe(1);

      expect(called).toBe(false);
    });

    test("stays silent for a valid value", () => {
      let called = false;

      expect(
        resolveConcurrency("3", () => {
          called = true;
        }),
      ).toBe(3);

      expect(called).toBe(false);
    });

    test("is optional", () => {
      expect(() => resolveConcurrency("nope")).not.toThrow();
    });
  });

  test("never returns a value BullMQ would treat as idle", () => {
    const inputs = [
      undefined, "", " ", "abc", "0", "-1", "1.5", "1", "3", "10",
      "1e3", "+2", "NaN", "Infinity", "999999999999999999999",
    ];

    for (const raw of inputs) {
      const result = resolveConcurrency(raw);

      expect(Number.isSafeInteger(result)).toBe(true);
      expect(result).toBeGreaterThanOrEqual(1);
    }
  });
});
