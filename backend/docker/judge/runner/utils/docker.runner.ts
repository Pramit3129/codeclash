import fs from "node:fs/promises";
import path from "node:path";
import crypto from "node:crypto";
import { spawn } from "node:child_process";

import type { RunRequest, RunResult } from "../types/runner.type.ts";
import { LANGUAGE_CONFIG, type LanguageConfig } from "../config/language.config.ts";

export interface Sandbox {
  executionId: string;
  executionDir: string;
  containerName: string;
  poisoned: boolean;
}

export const JUDGE_CONTAINER_LABEL = "com.algoriumx.judge";

const KILL_GRACE_MS = 3_000;
const DOCKER_AUX_TIMEOUT_MS = 10_000;
const COMPILE_TIMEOUT_MS = 20_000;
const MAX_COMPILE_OUTPUT_BYTES = 8 * 1024;

/** How much of each stream is kept when the caller doesn't ask for more. */
const DEFAULT_MAX_STORED_OUTPUT_BYTES = 4 * 1024;
const COMPILE_TIMEOUT_EXIT_CODE = 124;

export class DockerRunner {
  private readonly baseDir = process.env.JUDGE_WORK_DIR ?? "/tmp/algoriumx";

  /**
   * Creates host execution directory, writes source code, and starts isolated container.
   */
  async createSandbox(request: RunRequest): Promise<Sandbox> {
    const config = LANGUAGE_CONFIG[request.language];

    if (!config) {
      throw new Error(`Unsupported language: ${request.language}`);
    }

    const executionId = crypto.randomUUID();
    const executionDir = path.join(this.baseDir, executionId);

    await fs.mkdir(executionDir, { recursive: true });

    const sourcePath = path.join(executionDir, config.sourceFile);
    await fs.writeFile(sourcePath, request.sourceCode, "utf8");

    const containerName = `algoriumx-${executionId}`;

    await this.startContainer({
      containerName,
      executionDir,
      memoryLimitMb: request.memoryLimitMb,
      config,
    });

    return {
      executionId,
      executionDir,
      containerName,
      poisoned: false,
    };
  }

  /**
   * Prepares sandbox (e.g. compilation) before running test cases.
   */
  async prepareSandbox(
    sandbox: Sandbox,
    request: RunRequest,
  ): Promise<{ exitCode: number | null; stdout: string; stderr: string } | null> {
    const config = LANGUAGE_CONFIG[request.language];

    if (!config || config.prepareCommand.length === 0) {
      return null;
    }

    return new Promise((resolve, reject) => {
      const child = spawn("docker", [
        "exec",
        "-i",
        sandbox.containerName,
        ...config.prepareCommand,
      ]);

      let stdout = "";
      let stderr = "";
      let settled = false;

      const timer = setTimeout(() => {
        if (settled) return;
        settled = true;

        const kill = spawn("docker", [
          "exec",
          sandbox.containerName,
          "sh",
          "-c",
          "kill -KILL -1",
        ]);

        kill.on("error", () => {});

        try {
          child.kill("SIGKILL");
        } catch {}

        resolve({
          exitCode: COMPILE_TIMEOUT_EXIT_CODE,
          stdout,
          stderr: stderr + `\nCompilation exceeded the ${COMPILE_TIMEOUT_MS}ms limit.`,
        });
      }, COMPILE_TIMEOUT_MS);

      child.stdout.on("data", (data: Buffer) => {
        stdout = this.appendOutputPreview(
          stdout,
          data,
          MAX_COMPILE_OUTPUT_BYTES,
        ).text;
      });

      child.stderr.on("data", (data: Buffer) => {
        stderr = this.appendOutputPreview(
          stderr,
          data,
          MAX_COMPILE_OUTPUT_BYTES,
        ).text;
      });

      child.on("error", (error) => {
        if (settled) return;
        settled = true;
        clearTimeout(timer);
        reject(error);
      });

      child.on("close", (exitCode) => {
        if (settled) return;
        settled = true;
        clearTimeout(timer);
        resolve({ exitCode, stdout, stderr });
      });
    });
  }

  /** Keeps at most `maxBytes` of a stream, reporting whether bytes were dropped. */
  private appendOutputPreview(
    current: string,
    chunk: Buffer,
    maxBytes: number,
  ): { text: string; truncated: boolean } {
    const currentBytes = Buffer.byteLength(current, "utf8");
    if (currentBytes >= maxBytes) return { text: current, truncated: true };

    const remaining = maxBytes - currentBytes;
    if (chunk.length <= remaining) {
      return { text: current + chunk.toString(), truncated: false };
    }

    return {
      text: current + chunk.subarray(0, remaining).toString(),
      truncated: true,
    };
  }

  /**
   * Executes user program for one test case inside running sandbox.
   */
  async execute(
    sandbox: Sandbox,
    request: RunRequest,
    stdin: string,
  ): Promise<RunResult> {
    if (sandbox.poisoned) {
      throw new Error(`Refusing to execute in poisoned sandbox ${sandbox.containerName}`);
    }

    let stdout = "";
    let stderr = "";
    let timedOut = false;
    let outputExceeded = false;
    let stdoutTruncated = false;
    let stderrTruncated = false;

    const MAX_OUTPUT_BYTES = 1024 * 1024;
    const maxStoredOutputBytes =
      request.maxStoredOutputBytes ?? DEFAULT_MAX_STORED_OUTPUT_BYTES;
    let stdoutBytes = 0;
    let stderrBytes = 0;

    const config = LANGUAGE_CONFIG[request.language];
    if (!config) {
      throw new Error(`Unsupported language: ${request.language}`);
    }

    const child = spawn("docker", [
      "exec",
      "-i",
      sandbox.containerName,
      ...config.executeCommand,
    ]);

    return new Promise<RunResult>((resolve, reject) => {
      let settled = false;

      let limitTimer: ReturnType<typeof setTimeout> | null = setTimeout(() => {
        timedOut = true;
        enforceLimit();
      }, request.timeLimitMs);

      let graceTimer: ReturnType<typeof setTimeout> | null = null;

      const clearTimers = () => {
        if (limitTimer) {
          clearTimeout(limitTimer);
          limitTimer = null;
        }
        if (graceTimer) {
          clearTimeout(graceTimer);
          graceTimer = null;
        }
      };

      const settle = (exitCode: number | null, memoryExceeded: boolean) => {
        if (settled) return;
        settled = true;
        clearTimers();
        resolve({
          stdout,
          stderr,
          exitCode,
          timedOut,
          memoryExceeded,
          outputExceeded,
          stdoutTruncated,
          stderrTruncated,
        });
      };

      const fail = (error: Error) => {
        if (settled) return;
        settled = true;
        clearTimers();
        reject(error);
      };

      const abandon = () => {
        if (settled) return;
        sandbox.poisoned = true;
        try {
          child.kill("SIGKILL");
        } catch {}
        settle(null, false);
      };

      let killIssued = false;

      const killAllUserProcesses = () => {
        if (killIssued) return;
        killIssued = true;

        const kill = spawn("docker", [
          "exec",
          sandbox.containerName,
          "sh",
          "-c",
          "kill -KILL -1",
        ]);

        kill.on("error", () => {});
      };

      function enforceLimit() {
        killAllUserProcesses();
        if (graceTimer === null) {
          graceTimer = setTimeout(abandon, KILL_GRACE_MS);
        }
      }

      child.stderr.on("data", (data: Buffer) => {
        stderrBytes += data.length;
        if (stderrBytes > MAX_OUTPUT_BYTES && !outputExceeded) {
          outputExceeded = true;
          enforceLimit();
        }
        const appended = this.appendOutputPreview(
          stderr,
          data,
          maxStoredOutputBytes,
        );
        stderr = appended.text;
        stderrTruncated ||= appended.truncated;
      });

      child.stdout.on("data", (data: Buffer) => {
        stdoutBytes += data.length;
        if (stdoutBytes > MAX_OUTPUT_BYTES && !outputExceeded) {
          outputExceeded = true;
          enforceLimit();
        }
        const appended = this.appendOutputPreview(
          stdout,
          data,
          maxStoredOutputBytes,
        );
        stdout = appended.text;
        stdoutTruncated ||= appended.truncated;
      });

      child.on("error", (error) => {
        fail(error);
      });

      child.stdin.on("error", () => {});

      const finishWith = async (exitCode: number | null) => {
        if (settled) return;
        if (limitTimer) {
          clearTimeout(limitTimer);
          limitTimer = null;
        }

        const memoryExceeded =
          !timedOut &&
          !outputExceeded &&
          (await this.isOOMKilled(sandbox.containerName));

        settle(exitCode, memoryExceeded);
      };

      child.on("close", (exitCode) => {
        void finishWith(exitCode);
      });

      child.stdin.write(stdin);
      child.stdin.end();
    });
  }

  /**
   * Destroys container and cleans host execution directory.
   */
  async destroySandbox(sandbox: Sandbox): Promise<void> {
    console.log(`[Sandbox] Destroying ${sandbox.containerName}`);

    try {
      await this.removeContainer(sandbox.containerName);
      console.log(`[Sandbox] Container removed: ${sandbox.containerName}`);
    } catch (error) {
      console.error(`[Sandbox] Failed to remove container ${sandbox.containerName}`, error);
    }

    try {
      await fs.rm(sandbox.executionDir, { recursive: true, force: true });
      console.log(`[Sandbox] Directory removed: ${sandbox.executionDir}`);
    } catch (error) {
      console.error(`[Sandbox] Failed to remove directory`, error);
    }
  }

  /**
   * Starts persistent sandbox container in background.
   */
  private startContainer({
    containerName,
    executionDir,
    memoryLimitMb,
    config,
  }: {
    containerName: string;
    executionDir: string;
    memoryLimitMb: number;
    config: LanguageConfig;
  }): Promise<void> {
    return new Promise((resolve, reject) => {
      const docker = spawn("docker", [
        "run",
        "-d",
        "--name",
        containerName,
        "--network",
        "none",
        "--pids-limit",
        "100",
        "--memory",
        `${memoryLimitMb}m`,
        "--memory-swap",
        `${memoryLimitMb}m`,
        "--cpus",
        "0.5",
        "--read-only",
        "--tmpfs",
        `/tmp:exec,size=${memoryLimitMb}m`,
        "--cap-drop",
        "ALL",
        "--security-opt",
        "no-new-privileges",
        "--label",
        `${JUDGE_CONTAINER_LABEL}=1`,
        "-v",
        `${executionDir}:/sandbox:ro`,
        "--entrypoint",
        "sleep",
        config.image,
        "infinity",
      ]);

      let stderr = "";

      docker.stderr.on("data", (data) => {
        stderr += data.toString();
      });

      docker.on("error", (error) => {
        reject(error);
      });

      docker.on("close", (exitCode) => {
        if (exitCode !== 0) {
          reject(new Error(`Failed to start sandbox: ${stderr}`));
          return;
        }
        resolve();
      });
    });
  }

  private isOOMKilled(containerName: string): Promise<boolean> {
    return new Promise((resolve) => {
      const inspect = spawn("docker", [
        "inspect",
        containerName,
        "--format",
        "{{.State.OOMKilled}}",
      ]);

      let output = "";
      let done = false;

      const finish = (value: boolean) => {
        if (done) return;
        done = true;
        clearTimeout(timer);
        resolve(value);
      };

      const timer = setTimeout(() => {
        try {
          inspect.kill("SIGKILL");
        } catch {}
        finish(false);
      }, DOCKER_AUX_TIMEOUT_MS);

      inspect.stdout.on("data", (data) => {
        output += data.toString();
      });

      inspect.on("error", () => {
        finish(false);
      });

      inspect.on("close", () => {
        finish(output.trim() === "true");
      });
    });
  }

  /**
   * Reaps orphaned sandboxes left by crashed worker processes.
   */
  async reapOrphanedSandboxes(): Promise<string[]> {
    const names = await new Promise<string[]>((resolve) => {
      const list = spawn("docker", [
        "ps",
        "-a",
        "--filter",
        `label=${JUDGE_CONTAINER_LABEL}=1`,
        "--format",
        "{{.Names}}",
      ]);

      let output = "";
      let done = false;

      const finish = (value: string[]) => {
        if (done) return;
        done = true;
        clearTimeout(timer);
        resolve(value);
      };

      const timer = setTimeout(() => {
        try {
          list.kill("SIGKILL");
        } catch {}
        finish([]);
      }, DOCKER_AUX_TIMEOUT_MS);

      list.stdout.on("data", (data) => {
        output += data.toString();
      });

      list.on("error", () => {
        finish([]);
      });

      list.on("close", () => {
        finish(
          output
            .split("\n")
            .map((line) => line.trim())
            .filter(Boolean),
        );
      });
    });

    const reaped: string[] = [];

    for (const name of names) {
      try {
        await this.removeContainer(name);
        reaped.push(name);
      } catch (error) {
        console.error(`[Reaper] Failed to remove ${name}`, error);
      }
    }

    let entries: string[] = [];

    try {
      entries = await fs.readdir(this.baseDir);
    } catch (error) {
      const code = (error as NodeJS.ErrnoException).code;
      if (code !== "ENOENT") {
        console.error("[Reaper] Failed to list execution directories", error);
      }
    }

    for (const entry of entries) {
      try {
        await fs.rm(path.join(this.baseDir, entry), {
          recursive: true,
          force: true,
        });
      } catch (error) {
        console.error(`[Reaper] Failed to remove execution directory ${entry}`, error);
      }
    }

    return reaped;
  }

  private removeContainer(containerName: string): Promise<void> {
    return new Promise((resolve, reject) => {
      console.log(`[Docker] Removing container: ${containerName}`);

      const remove = spawn("docker", ["rm", "-f", containerName]);

      let stderr = "";
      let done = false;

      const timer = setTimeout(() => {
        if (done) return;
        done = true;
        try {
          remove.kill("SIGKILL");
        } catch {}
        reject(new Error(`docker rm timed out for ${containerName}`));
      }, DOCKER_AUX_TIMEOUT_MS);

      remove.stderr.on("data", (data) => {
        stderr += data.toString();
      });

      remove.on("error", (error) => {
        if (done) return;
        done = true;
        clearTimeout(timer);
        reject(error);
      });

      remove.on("close", (exitCode) => {
        if (done) return;
        done = true;
        clearTimeout(timer);

        if (exitCode === 0 || stderr.includes("No such container")) {
          resolve();
          return;
        }

        reject(new Error(`docker rm failed with exit code ${exitCode}: ${stderr.trim()}`));
      });
    });
  }
}
