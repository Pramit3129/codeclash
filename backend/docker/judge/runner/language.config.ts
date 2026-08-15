import type { SupportedLanguage } from "./runner.type.ts";

export interface LanguageConfig {
  image: string;
  sourceFile: string;
  prepareCommand: string[];
  executeCommand: string[];
}

/*
 * SEMANTICS: a syntax error is CE in every language, including the
 * interpreted ones.
 *
 * Python and JavaScript have no separate compile step, so a malformed
 * program used to surface as RE — the same verdict as a genuine runtime
 * crash, and a different verdict from the identical typo in Java or C++.
 * That made verdicts inconsistent across languages and hid the
 * difference between "did not build" and "built but crashed".
 *
 * These prepare commands only PARSE the source; they never execute it,
 * so a program that parses cleanly and then throws is still RE.
 */
export const LANGUAGE_CONFIG: Record<
  SupportedLanguage,
  LanguageConfig
> = {
  python: {
    image: "algoriumx-judge-python:1",
    sourceFile: "main.py",
    prepareCommand: [
      /*
       * ast.parse rather than py_compile: it needs no write access,
       * and /sandbox is mounted read-only.
       */
      "python3",
      "-c",
      "import ast,sys;ast.parse(open('/sandbox/main.py').read())",
    ],
    executeCommand: [
      "python3",
      "/sandbox/main.py",
    ],
  },

  javascript: {
    image: "algoriumx-judge-javascript:1",
    sourceFile: "main.js",
    prepareCommand: [
      // Parses only; does not run the program.
      "node",
      "--check",
      "/sandbox/main.js",
    ],
    executeCommand: [
      "node",
      "/sandbox/main.js",
    ],
  },

  java: {
    image: "algoriumx-judge-java:1",
    sourceFile: "Main.java",
    prepareCommand: [
      "sh",
      "-c",
      "mkdir -p /tmp/java && javac -d /tmp/java /sandbox/Main.java",
    ],
    executeCommand: [
      "java",
      "-cp",
      "/tmp/java",
      "Main",
    ],
  },

  cpp: {
    image: "algoriumx-judge-cpp:1",
    sourceFile: "main.cpp",
    prepareCommand: [
      "sh",
      "-c",
      "g++ -std=c++20 -O2 /sandbox/main.cpp -o /tmp/main",
    ],
    executeCommand: [
      "/tmp/main",
    ],
  },
};
