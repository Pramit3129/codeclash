/**
 * RunService.resolveTestCases: which client-supplied cases may be judged as
 * samples. A trust boundary, so the forged cases matter as much as the
 * honest ones. Pure unit tests.
 */
import { describe, expect, test } from "bun:test";

import { RunService } from "../src/modules/run/run.service.ts";
import type { RunTestCase } from "../docker/judge/runner/types/run.type.ts";
import type { RunTestCaseInput } from "../src/modules/run/run.types.ts";

const samples = [
  { id: "db-0", ordinal: 0, input: "2 3\n", expectedOutput: "5\n" },
  { id: "db-1", ordinal: 1, input: "10 20\n", expectedOutput: "30\n" },
];

const resolve = (supplied?: RunTestCaseInput[]): RunTestCase[] =>
  (
    new RunService() as unknown as {
      resolveTestCases: (
        s: typeof samples,
        c?: RunTestCaseInput[],
      ) => RunTestCase[];
    }
  ).resolveTestCases(samples, supplied);

describe("no explicit cases", () => {
  test("an omitted list runs every stored sample", () => {
    const resolved = resolve(undefined);

    expect(resolved).toHaveLength(2);
    expect(resolved.every((c) => c.isSample)).toBe(true);
    expect(resolved.map((c) => c.id)).toEqual(["db-0", "db-1"]);
  });

  test("an empty list is treated the same way", () => {
    expect(resolve([])).toHaveLength(2);
  });
});

describe("honest sample cases are judged", () => {
  test("ordinal with the exact stored input", () => {
    const [resolved] = resolve([
      { ordinal: 0, input: "2 3\n", isSample: true },
    ]);

    expect(resolved!.isSample).toBe(true);
    expect(resolved!.expectedOutput).toBe("5\n");
  });

  test("ordinal alone, input omitted", () => {
    const [resolved] = resolve([{ ordinal: 1 }]);

    expect(resolved!.isSample).toBe(true);
    expect(resolved!.stdin).toBe("10 20\n");
  });

  test("no ordinal, but the input round-trips a stored sample", () => {
    const [resolved] = resolve([{ input: "2 3\n" }]);

    expect(resolved!.isSample).toBe(true);
    expect(resolved!.id).toBe("db-0");
  });

  test.each([
    ["trailing newline dropped by a textarea", "2 3"],
    ["CRLF line endings", "2 3\r\n"],
    ["trailing spaces", "2 3   "],
  ])("survives %s", (_label, input) => {
    const [resolved] = resolve([{ ordinal: 0, input, isSample: true }]);

    expect(resolved!.isSample).toBe(true);
    // Whatever drifted, the program is fed the stored input.
    expect(resolved!.stdin).toBe("2 3\n");
  });
});

describe("forged sample claims are refused", () => {
  test.each([
    ["isSample true with no ordinal", { input: "41 1", isSample: true }],
    [
      "isSample true with a stolen ordinal",
      { ordinal: 0, input: "41 1", isSample: true },
    ],
    [
      "an ordinal that is not a sample of this problem",
      { ordinal: 99, input: "41 1", isSample: true },
    ],
  ])("%s stays custom", (_label, supplied) => {
    const [resolved] = resolve([supplied as RunTestCaseInput]);

    expect(resolved!.isSample).toBe(false);
    expect(resolved!.expectedOutput).toBeUndefined();
  });

  test("a forged case still runs, with the user's own input", () => {
    const [resolved] = resolve([
      { ordinal: 0, input: "41 1", isSample: true },
    ]);

    expect(resolved!.stdin).toBe("41 1");
  });

  test("a forged case never reveals a stored expected output", () => {
    const [resolved] = resolve([
      { ordinal: 1, input: "whatever", isSample: true },
    ]);

    expect(resolved!.expectedOutput).toBeUndefined();
  });
});

describe("edited samples become custom", () => {
  test("a real edit to the input drops the verdict", () => {
    const [resolved] = resolve([
      { ordinal: 1, input: "10 21", isSample: true },
    ]);

    expect(resolved!.isSample).toBe(false);
    expect(resolved!.stdin).toBe("10 21");
  });

  test("changing whitespace inside the input is a real edit", () => {
    const [resolved] = resolve([
      { ordinal: 0, input: "2  3", isSample: true },
    ]);

    expect(resolved!.isSample).toBe(false);
  });
});

describe("the client can narrow, never widen", () => {
  test("isSample false on a genuine sample is honoured", () => {
    const [resolved] = resolve([
      { ordinal: 0, input: "2 3\n", isSample: false },
    ]);

    expect(resolved!.isSample).toBe(false);
  });
});

describe("mixed lists", () => {
  test("samples and custom cases keep their order and identity", () => {
    const resolved = resolve([
      { ordinal: 0, input: "2 3" },
      { input: "100 250" },
      { ordinal: 1, input: "10 20" },
      { input: "7 8" },
    ]);

    expect(resolved.map((c) => c.isSample)).toEqual([true, false, true, false]);
    expect(resolved.map((c) => c.id)).toEqual([
      "db-0",
      "custom-1",
      "db-1",
      "custom-3",
    ]);
  });
});
