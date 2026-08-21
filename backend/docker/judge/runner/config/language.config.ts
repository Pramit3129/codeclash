import type { SupportedLanguage } from "../types/runner.type.ts";

export interface LanguageConfig {
  image: string;
  sourceFile: string;
  prepareCommand: string[];
  executeCommand: string[];
}

export const LANGUAGE_CONFIG: Record<
  SupportedLanguage,
  LanguageConfig
> = {
  python: {
    image: "algoriumx-judge-python:1",
    sourceFile: "main.py",
    prepareCommand: [
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
