import { describe, expect, test } from "bun:test";

import { DockerRunner } from "../utils/docker.runner.ts";
import { OutputComparator } from "../utils/output.comparator.ts";
import { JudgeService } from "../services/judge.service.ts";

import type { RunResult } from "../types/runner.type.ts";

const judge = new JudgeService(new DockerRunner(), new OutputComparator());

const result = (over: Partial<RunResult> = {}): RunResult => ({
  stdout: "",
  stderr: "",
  exitCode: 0,
  timedOut: false,
  memoryExceeded: false,
  outputExceeded: false,
  stdoutTruncated: false,
  stderrTruncated: false,
  ...over,
});

const classify = (over: Partial<RunResult> = {}) =>
  judge.classifyExecution(result(over));

describe("classifyExecution", () => {
  describe("required mappings", () => {
    test("timedOut -> TLE", () => {
      expect(classify({ timedOut: true })).toBe("TLE");
    });

    test("memoryExceeded -> MLE", () => {
      expect(classify({ memoryExceeded: true })).toBe("MLE");
    });

    test("outputExceeded -> OLE", () => {
      expect(classify({ outputExceeded: true })).toBe("OLE");
    });

    test("non-zero exitCode -> RE", () => {
      expect(classify({ exitCode: 1 })).toBe("RE");
    });

    test("exitCode 0 with no resource violation -> null", () => {
      expect(classify()).toBeNull();
    });
  });

  describe("non-zero exit codes are all RE", () => {
    test.each([1, 2, 42, 124, 127, 134, 139, 255])("exitCode %i -> RE", (code) => {
      expect(classify({ exitCode: code })).toBe("RE");
    });

    test("a null exitCode is RE, not a pass", () => {
      expect(classify({ exitCode: null })).toBe("RE");
    });
  });

  describe("precedence when signals overlap", () => {
    test("timedOut wins over exit code 137", () => {
      expect(classify({ timedOut: true, exitCode: 137 })).toBe("TLE");
    });

    test("outputExceeded wins over exit code 137", () => {
      expect(classify({ outputExceeded: true, exitCode: 137 })).toBe("OLE");
    });

    test("memoryExceeded wins over exit code 137", () => {
      expect(classify({ memoryExceeded: true, exitCode: 137 })).toBe("MLE");
    });

    test("timedOut wins over memoryExceeded (sticky OOM flag)", () => {
      expect(classify({ timedOut: true, memoryExceeded: true })).toBe("TLE");
    });

    test("timedOut wins over outputExceeded", () => {
      expect(classify({ timedOut: true, outputExceeded: true })).toBe("TLE");
    });

    test("memoryExceeded wins over outputExceeded", () => {
      expect(classify({ memoryExceeded: true, outputExceeded: true })).toBe("MLE");
    });

    test("all flags set resolves to TLE", () => {
      expect(
        classify({
          timedOut: true,
          memoryExceeded: true,
          outputExceeded: true,
          exitCode: 137,
        }),
      ).toBe("TLE");
    });
  });

  describe("a resource breach is never masked by a clean exit code", () => {
    test.each([
      ["timedOut", { timedOut: true }, "TLE"],
      ["memoryExceeded", { memoryExceeded: true }, "MLE"],
      ["outputExceeded", { outputExceeded: true }, "OLE"],
    ] as const)("%s with exitCode 0 still -> %s", (_label, over, want) => {
      expect(classify({ ...over, exitCode: 0 })).toBe(want);
    });
  });

  describe("output content does not influence classification", () => {
    test("stdout/stderr are ignored for a clean run", () => {
      expect(
        classify({ stdout: "anything at all", stderr: "warnings here" }),
      ).toBeNull();
    });

    test("stderr alone does not imply RE", () => {
      expect(classify({ stderr: "deprecation warning", exitCode: 0 })).toBeNull();
    });
  });

  test("only ever returns a failure verdict or null", () => {
    const allowed = new Set(["TLE", "MLE", "OLE", "RE", null]);

    for (const timedOut of [true, false]) {
      for (const memoryExceeded of [true, false]) {
        for (const outputExceeded of [true, false]) {
          for (const exitCode of [0, 1, 137, null]) {
            const verdict = classify({
              timedOut,
              memoryExceeded,
              outputExceeded,
              exitCode,
            });

            expect(allowed.has(verdict)).toBe(true);
            expect(verdict).not.toBe("AC");
            expect(verdict).not.toBe("WA");
            expect(verdict).not.toBe("CE");
          }
        }
      }
    }
  });
});
