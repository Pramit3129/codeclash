/**
 * OutputComparator: normalization and comparison semantics.
 *
 * Pure unit tests — no Docker, no database, no network.
 *
 * Replaces output.comparator.manual.ts, which printed three booleans to
 * stdout and asserted nothing.
 */
import { describe, expect, test } from "bun:test";

import { OutputComparator } from "../output.comparator.ts";

const comparator = new OutputComparator();
const n = (s: string) => comparator.normalize(s);

describe("normalize()", () => {
  describe("trims surrounding whitespace", () => {
    test.each([
      ["   10", "10"],
      ["10   ", "10"],
      ["\t10\t", "10"],
      ["\n\n10\n\n", "10"],
      ["  \n 10 \n  ", "10"],
    ])("%j -> %j", (input, expected) => {
      expect(n(input)).toBe(expected);
    });
  });

  describe("collapses internal whitespace runs to a single space", () => {
    test.each([
      ["10   20", "10 20"],
      ["10\t\t20", "10 20"],
      ["10 \t 20", "10 20"],
      ["1  2   3    4", "1 2 3 4"],
    ])("%j -> %j", (input, expected) => {
      expect(n(input)).toBe(expected);
    });
  });

  describe("trailing newlines", () => {
    test.each([
      ["10\n", "10"],
      ["10\n\n\n", "10"],
      ["10", "10"],
    ])("%j -> %j", (input, expected) => {
      expect(n(input)).toBe(expected);
    });

    test("a missing trailing newline is equivalent to having one", () => {
      expect(n("10\n")).toBe(n("10"));
    });
  });

  describe("CRLF vs LF", () => {
    test.each([
      ["10\r\n", "10"],
      ["10\r\n20\r\n", "10 20"],
      ["10\n20\n", "10 20"],
      ["10\r20", "10 20"],
    ])("%j -> %j", (input, expected) => {
      expect(n(input)).toBe(expected);
    });

    test("CRLF and LF line endings normalize identically", () => {
      expect(n("1 2\r\n3 4\r\n")).toBe(n("1 2\n3 4\n"));
    });
  });

  describe("line structure is flattened, not preserved", () => {
    /*
     * Documents a real property of this comparator: newlines are treated
     * as ordinary whitespace, so multi-line output is compared purely as
     * a token sequence. "1\n2" and "1 2" are therefore equal.
     */
    test("newlines and spaces are interchangeable", () => {
      expect(n("1\n2")).toBe("1 2");
      expect(n("1 2")).toBe("1 2");
    });
  });

  describe("edge cases", () => {
    test.each([
      ["", ""],
      ["   ", ""],
      ["\n", ""],
      ["\r\n", ""],
      ["\t \n ", ""],
    ])("whitespace-only %j -> empty string", (input, expected) => {
      expect(n(input)).toBe(expected);
    });

    test("is idempotent", () => {
      for (const s of ["10", "  1  2  ", "a\r\nb\n", "", "   "]) {
        expect(n(n(s))).toBe(n(s));
      }
    });

    test("does not alter token content", () => {
      expect(n("  -5  1000000  ")).toBe("-5 1000000");
      expect(n("Hello,   World!\n")).toBe("Hello, World!");
    });
  });
});

describe("compare()", () => {
  describe("accepts output differing only in whitespace", () => {
    test.each([
      ["10\n", "10\n"],
      ["10", "10\n"],
      ["10\r\n", "10\n"],
      ["10   20\n30 40\n", "10 20\n30 40\n"],
      ["  5  ", "5"],
      ["1\n2\n3\n", "1\n2\n3"],
    ])("compare(%j, %j) === true", (actual, expected) => {
      expect(comparator.compare(actual, expected)).toBe(true);
    });
  });

  describe("rejects genuinely different output", () => {
    test.each([
      ["11\n", "10\n"],
      ["10 20", "20 10"],
      ["", "10"],
      ["10", ""],
      ["100", "10 0"],
      ["-5", "5"],
    ])("compare(%j, %j) === false", (actual, expected) => {
      expect(comparator.compare(actual, expected)).toBe(false);
    });
  });

  test("matches the Sum of Two Numbers reference outputs", () => {
    for (const [actual, expected] of [
      ["5\n", "5\n"],
      ["30\n", "30\n"],
      ["300\n", "300\n"],
      ["-5\n", "-5\n"],
      ["1000000\n", "1000000\n"],
    ] as const) {
      expect(comparator.compare(actual, expected)).toBe(true);
    }
  });

  test("is symmetric", () => {
    expect(comparator.compare("10\n", "10")).toBe(
      comparator.compare("10", "10\n"),
    );

    expect(comparator.compare("11", "10")).toBe(
      comparator.compare("10", "11"),
    );
  });
});
