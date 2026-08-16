/**
 * JudgeService.classifyExecution(): pure verdict classification.
 *
 * NO DOCKER. Constructing DockerRunner/JudgeService has no side effects
 * — no container, process or connection is created until a method is
 * called — and classifyExecution() only reads the RunResult it is given.
 *
 * The precedence rules encoded here are load-bearing: TLE and OLE are
 * enforced by SIGKILLing the program, which yields exit code 137, and
 * the container's OOMKilled flag is sticky. Classifying on exit code
 * first would report those as RE, and trusting a stale OOM flag would
 * report them as MLE.
 */
import { describe, expect, test } from "bun:test";

import { DockerRunner } from "../docker.runner.ts";
import { OutputComparator } from "../output.comparator.ts";
import { JudgeService } from "../judge.service.ts";

import type { RunResult } from "../runner.type.ts";

const judge = new JudgeService(new DockerRunner(), new OutputComparator());

/** A clean, successful execution; override one field per case. */
const result = (over: Partial<RunResult> = {}): RunResult => ({
  stdout: "",
  stderr: "",
  exitCode: 0,
  timedOut: false,
  memoryExceeded: false,
  outputExceeded: false,
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
      // Produced when an execution is abandoned after the kill grace period.
      expect(classify({ exitCode: null })).toBe("RE");
    });
  });

  describe("precedence when signals overlap", () => {
    /*
     * A SIGKILLed program reports 137. Every combination below must
     * still resolve to the limit that was actually breached.
     */
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

            // AC/WA/CE are decided elsewhere and must never appear here.
            expect(verdict).not.toBe("AC");
            expect(verdict).not.toBe("WA");
            expect(verdict).not.toBe("CE");
          }
        }
      }
    }
  });
});
