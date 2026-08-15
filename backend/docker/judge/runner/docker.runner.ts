// import fs from "node:fs/promises";
// import path from "node:path";
// import crypto from "node:crypto";
// import { spawn } from "node:child_process";

// import type {
//   RunRequest,
//   RunResult,
// } from "./runner.type.ts";

// export class DockerRunner {
//   private readonly baseDir = "/tmp/algoriumx";

//   /**
//    * Creates an isolated directory for one submission
//    * and writes the user's source code into main.py.
//    */
//   async prepareSubmission(
//     sourceCode: string,
//   ): Promise<string> {
//     const executionId = crypto.randomUUID();

//     const executionDir = path.join(
//       this.baseDir,
//       executionId,
//     );

//     await fs.mkdir(executionDir, {
//       recursive: true,
//     });

//     const sourcePath = path.join(
//       executionDir,
//       "main.py",
//     );

//     await fs.writeFile(
//       sourcePath,
//       sourceCode,
//       "utf8",
//     );

//     return executionDir;
//   }
//   private removeContainer(
//     containerName: string,
//   ): Promise<void> {
//     return new Promise((resolve) => {
//       const remove = spawn("docker", [
//         "rm",
//         "-f",
//         containerName,
//       ]);

//       remove.on("close", () => {
//         resolve();
//       });

//       remove.on("error", () => {
//         resolve();
//       });
//     });
//   }

//   /**
//    * Starts the Docker sandbox, sends stdin,
//    * collects stdout/stderr and enforces the timeout.
//    */
//   private runDocker(
//     executionDir: string,
//     request: RunRequest,
//   ): Promise<RunResult> {
//     return new Promise((resolve, reject) => {
//       const executionId = path.basename(executionDir);

//       const containerName =
//         `algoriumx-${executionId}`;

//       let stdout = "";
//       let stderr = "";
//       let timedOut = false;

//       const docker = spawn("docker", [
//         "run",

//         /*
//          * IMPORTANT:
//          * We removed --rm.
//          *
//          * We need the container to remain temporarily so that
//          * we can inspect:
//          *
//          * .State.OOMKilled
//          *
//          * After inspection we explicitly remove it.
//          */

//         "-i",

//         "--name",
//         containerName,

//         "--network",
//         "none",

//         "--pids-limit",
//         "10",

//         "--memory",
//         `${request.memoryLimitMb}m`,

//         "--cpus",
//         "0.5",

//         "--read-only",

//         "--tmpfs",
//         "/tmp",

//         "--cap-drop",
//         "ALL",

//         "-v",
//         `${executionDir}:/sandbox:ro`,

//         "algoriumx-judge-python:1",
//       ]);

//       /*
//        * Node owns the wall-clock timeout.
//        */
//       const timeout = setTimeout(() => {
//         timedOut = true;

//         /*
//          * Kill the ACTUAL container.
//          */
//         const killProcess = spawn("docker", [
//           "kill",
//           containerName,
//         ]);

//         killProcess.on("error", () => {
//           // Container may already have exited.
//         });
//       }, request.timeLimitMs);

//       /*
//        * Collect stdout.
//        */
//       docker.stdout.on("data", (data) => {
//         stdout += data.toString();
//       });

//       /*
//        * Collect stderr.
//        */
//       docker.stderr.on("data", (data) => {
//         stderr += data.toString();
//       });

//       /*
//        * Docker CLI itself failed.
//        */
//       docker.on("error", (error) => {
//         clearTimeout(timeout);
//         reject(error);
//       });

//       /*
//        * Docker finished.
//        *
//        * At this point the container has exited,
//        * but it still exists because --rm was removed.
//        */
//       docker.on("close", () => {
//         clearTimeout(timeout);

//         /*
//          * Now inspect the actual container.
//          */
//         const inspect = spawn("docker", [
//           "inspect",
//           containerName,
//           "--format",
//           "{{.State.ExitCode}} {{.State.OOMKilled}}",
//         ]);

//         let inspectOutput = "";
//         let inspectError = "";

//         inspect.stdout.on("data", (data) => {
//           inspectOutput += data.toString();
//         });

//         inspect.stderr.on("data", (data) => {
//           inspectError += data.toString();
//         });

//         inspect.on("error", async (error) => {
//           /*
//            * Try to clean up even if inspect fails.
//            */
//           await this.removeContainer(containerName);

//           reject(error);
//         });

//         inspect.on("close", async (inspectExitCode) => {
//           if (inspectExitCode !== 0) {
//             await this.removeContainer(containerName);

//             reject(
//               new Error(
//                 `Failed to inspect container: ${inspectError}`,
//               ),
//             );

//             return;
//           }

//           /*
//            * Example:
//            *
//            * "137 true"
//            *
//            * means:
//            *
//            * exitCode = 137
//            * OOMKilled = true
//            */
//           const [exitCodeString, oomKilledString] =
//             inspectOutput.trim().split(/\s+/);

//           const containerExitCode =
//             exitCodeString === "null"
//               ? null
//               : Number(exitCodeString);

//           const memoryExceeded =
//             oomKilledString === "true";

//           /*
//            * Remove container AFTER inspection.
//            */
//           await this.removeContainer(
//             containerName,
//           );

//           resolve({
//             stdout,
//             stderr,

//             /*
//              * This is the actual container exit code,
//              * not the Docker CLI's exit code.
//              */
//             exitCode: containerExitCode,

//             timedOut,

//             memoryExceeded,
//           });
//         });
//       });

//       /*
//        * Send stdin to the container.
//        */
//       docker.stdin.write(request.stdin);
//       docker.stdin.end();
//     });
//   }

//   /**
//    * Complete execution lifecycle:
//    *
//    * 1. Create execution directory
//    * 2. Write source code
//    * 3. Start sandbox
//    * 4. Send stdin
//    * 5. Collect result
//    * 6. ALWAYS delete host-side temporary files
//    */
//   async run(
//     request: RunRequest,
//   ): Promise<RunResult> {
//     const executionDir =
//       await this.prepareSubmission(
//         request.sourceCode,
//       );

//     console.log("DIR:", executionDir);

//     try {
//       return await this.runDocker(
//         executionDir,
//         request,
//       );
//     } finally {
//       /*
//        * This executes whether:
//        *
//        * - program succeeds
//        * - program crashes
//        * - timeout occurs
//        * - Docker fails
//        * - an exception occurs
//        *
//        * Therefore host-side submission files
//        * don't accumulate on the VPS.
//        */
//       await fs.rm(
//         executionDir,
//         {
//           recursive: true,
//           force: true,
//         },
//       );
//     }
//   }
// }

import fs from "node:fs/promises";
import path from "node:path";
import crypto from "node:crypto";
import { spawn } from "node:child_process";

import type {
  RunRequest,
  RunResult,
} from "./runner.type.ts";

import {
  LANGUAGE_CONFIG,
  type LanguageConfig,
} from "./language.config.ts";

export interface Sandbox {
  executionId: string;
  executionDir: string;
  containerName: string;

  /**
   * Set when an execution had to be force-abandoned (the sandbox was
   * left in an unknown state). Such a sandbox must not be reused for
   * further test cases — only destroyed.
   */
  poisoned: boolean;
}

/**
 * Docker label applied to every sandbox container so that the startup
 * reaper can identify judge-owned containers without ever touching
 * unrelated containers on the host.
 */
export const JUDGE_CONTAINER_LABEL = "com.algoriumx.judge";

/**
 * Grace period allowed for `docker exec` to tear down after we have
 * SIGKILLed the user's processes. If it elapses we abandon the exec
 * rather than let the worker hang forever.
 */
const KILL_GRACE_MS = 3_000;

/**
 * Upper bound on the auxiliary docker CLI calls (inspect / kill / rm).
 * A wedged docker daemon must not translate into a wedged worker.
 */
const DOCKER_AUX_TIMEOUT_MS = 10_000;

/**
 * Wall-clock bound on the language prepare/compile step.
 */
const COMPILE_TIMEOUT_MS = 20_000;

/**
 * Compiler diagnostics retained (bytes). Enough for a useful CE
 * message without letting a diagnostic flood grow the worker heap.
 */
const MAX_COMPILE_OUTPUT_BYTES = 8 * 1024;

/**
 * Synthetic non-zero exit code used when compilation is killed for
 * exceeding COMPILE_TIMEOUT_MS. JudgeService maps any non-zero
 * prepare exit code to CE.
 */
const COMPILE_TIMEOUT_EXIT_CODE = 124;

export class DockerRunner {
  /**
   * Host-side staging directory for submission source.
   *
   * CRITICAL DEPLOYMENT CONSTRAINT: the worker talks to the host's
   * Docker daemon over /var/run/docker.sock, so the `-v` path below is
   * resolved by the DAEMON on the HOST — not inside this process's
   * mount namespace. When the worker itself runs in a container, this
   * path must therefore be bind-mounted from the host to the SAME path
   * inside the worker, or Docker silently creates an empty host
   * directory and every submission fails to find its source file.
   *
   * See docker/judge/docker-compose.yml.
   */
  private readonly baseDir =
    process.env.JUDGE_WORK_DIR ?? "/tmp/algoriumx";

  /**
   * Creates the host-side execution directory,
   * writes the user's source code and starts
   * one isolated Docker container.
   *
   * The container remains alive until destroySandbox()
   * is called.
   */
  async createSandbox(
    request: RunRequest,
  ): Promise<Sandbox> {
    const config =
      LANGUAGE_CONFIG[request.language];

    if (!config) {
      throw new Error(
        `Unsupported language: ${request.language}`,
      );
    }

    const executionId = crypto.randomUUID();

    const executionDir = path.join(
      this.baseDir,
      executionId,
    );

    await fs.mkdir(executionDir, {
      recursive: true,
    });

    const sourcePath = path.join(
      executionDir,
      config.sourceFile,
    );

    await fs.writeFile(
      sourcePath,
      request.sourceCode,
      "utf8",
    );

    const containerName =
      `algoriumx-${executionId}`;

    /*
     * We keep the container running with a harmless
     * long-running command.
     *
     * We will execute the user's program inside this
     * container for each test case.
     */
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
   * Runs the language preparation command (e.g. compilation with javac/g++)
   * inside the sandbox before executing test cases.
   */
  async prepareSandbox(
    sandbox: Sandbox,
    request: RunRequest,
  ): Promise<{ exitCode: number | null; stdout: string; stderr: string } | null> {
    const config =
      LANGUAGE_CONFIG[request.language];

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

      /*
       * Compilation is attacker-controlled work: a template
       * recursion bomb (C++) or a pathological generic (Java) can
       * compile effectively forever. Without a bound this hangs the
       * worker exactly like an unbounded execution would.
       */
      const timer = setTimeout(() => {
        if (settled) {
          return;
        }

        settled = true;

        const kill = spawn("docker", [
          "exec",
          sandbox.containerName,
          "sh",
          "-c",
          "kill -KILL -1",
        ]);

        kill.on("error", () => {
          // Nothing left to kill.
        });

        try {
          child.kill("SIGKILL");
        } catch {
          // Already gone.
        }

        /*
         * Surfaced as a failed compile: from the user's perspective
         * their program did not build within the allowance.
         */
        resolve({
          exitCode: COMPILE_TIMEOUT_EXIT_CODE,
          stdout,
          stderr:
            stderr +
            `\nCompilation exceeded the ${COMPILE_TIMEOUT_MS}ms limit.`,
        });
      }, COMPILE_TIMEOUT_MS);

      /*
       * Compiler diagnostics are attacker-influenced too, so the
       * buffers must stay bounded.
       */
      child.stdout.on("data", (data: Buffer) => {
        stdout = this.appendOutputPreview(
          stdout,
          data,
          MAX_COMPILE_OUTPUT_BYTES,
        );
      });

      child.stderr.on("data", (data: Buffer) => {
        stderr = this.appendOutputPreview(
          stderr,
          data,
          MAX_COMPILE_OUTPUT_BYTES,
        );
      });

      child.on("error", (error) => {
        if (settled) {
          return;
        }

        settled = true;
        clearTimeout(timer);
        reject(error);
      });

      child.on("close", (exitCode) => {
        if (settled) {
          return;
        }

        settled = true;
        clearTimeout(timer);
        resolve({ exitCode, stdout, stderr });
      });
    });
  }


  private appendOutputPreview(
    current: string,
    chunk: Buffer,
    maxBytes: number,
  ): string {
    const currentBytes =
      Buffer.byteLength(current, "utf8");

    if (currentBytes >= maxBytes) {
      return current;
    }

    const remaining =
      maxBytes - currentBytes;

    if (chunk.length <= remaining) {
      return current + chunk.toString();
    }

    return (
      current +
      chunk
        .subarray(0, remaining)
        .toString()
    );
  }
  /**
   * Executes the user's program for ONE test case inside an
   * already-running sandbox.
   *
   * Enforcement model
   * -----------------
   * We never `docker kill` the sandbox to enforce TLE/OLE: that would
   * destroy the container, and JudgeService reuses one sandbox for the
   * whole submission.
   *
   * We also do NOT track the submitted program by PID. A PID file lives
   * on the sandbox's writable /tmp, so the submitted program can read
   * and overwrite it (verified empirically); pointing it at a dead PID
   * made the kill a no-op and hung the worker forever, and pointing it
   * at PID 1 let user code stop its own sandbox. PID-based killing also
   * leaves forked children running.
   *
   * Instead we SIGKILL the container's whole process namespace with
   * `kill -KILL -1`. Linux excludes PID 1 (the `sleep infinity`
   * entrypoint) and the calling shell from that broadcast, so the
   * sandbox survives while every user process — parent and all
   * children — dies. There is nothing on the writable filesystem for
   * user code to influence.
   *
   * INVARIANT: this makes an execution namespace-wide, so at most one
   * execution may be in flight per sandbox. JudgeService runs test
   * cases sequentially against its own sandbox, which satisfies this.
   *
   * The method is guaranteed to settle: every wait is bounded by the
   * time limit plus a kill grace period, after which the exec is
   * abandoned and the sandbox is marked poisoned.
   */
  async execute(
    sandbox: Sandbox,
    request: RunRequest,
    stdin: string,
  ): Promise<RunResult> {
    if (sandbox.poisoned) {
      throw new Error(
        `Refusing to execute in poisoned sandbox ${sandbox.containerName}`,
      );
    }

    let stdout = "";
    let stderr = "";

    let timedOut = false;
    let outputExceeded = false;

    const MAX_OUTPUT_BYTES = 1024 * 1024;
    const MAX_STORED_OUTPUT_BYTES = 4 * 1024;
    let stdoutBytes = 0;
    let stderrBytes = 0;

    const config =
      LANGUAGE_CONFIG[request.language];

    if (!config) {
      throw new Error(
        `Unsupported language: ${request.language}`,
      );
    }

    const child = spawn("docker", [
      "exec",
      "-i",

      sandbox.containerName,

      ...config.executeCommand,
    ]);

    return new Promise<RunResult>((resolve, reject) => {
      let settled = false;

      let limitTimer: ReturnType<typeof setTimeout> | null =
        setTimeout(() => {
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

      const settle = (
        exitCode: number | null,
        memoryExceeded: boolean,
      ) => {
        if (settled) {
          return;
        }

        settled = true;
        clearTimers();

        resolve({
          stdout,
          stderr,

          exitCode,

          timedOut,
          memoryExceeded,
          outputExceeded,
        });
      };

      const fail = (error: Error) => {
        if (settled) {
          return;
        }

        settled = true;
        clearTimers();

        reject(error);
      };

      /*
       * Abandon the exec. Used when the sandbox does not tear down
       * within the grace period after a SIGKILL broadcast. We detach
       * our side and mark the sandbox unusable; JudgeService destroys
       * it in its finally block.
       */
      const abandon = () => {
        if (settled) {
          return;
        }

        sandbox.poisoned = true;

        try {
          child.kill("SIGKILL");
        } catch {
          // The CLI process may already be gone.
        }

        /*
         * A limit breach is never MLE — we SIGKILLed it ourselves.
         */
        settle(null, false);
      };

      /*
       * SIGKILL every user process in the sandbox's PID namespace.
       * Idempotent: repeated breaches (e.g. TLE right after OLE) must
       * not spawn a kill storm.
       */
      let killIssued = false;

      const killAllUserProcesses = () => {
        if (killIssued) {
          return;
        }

        killIssued = true;

        const kill = spawn("docker", [
          "exec",
          sandbox.containerName,

          /*
           * `kill` is a shell builtin in these minimal judge images,
           * not a standalone executable, so it must go through `sh`.
           */
          "sh",
          "-c",
          "kill -KILL -1",
        ]);

        kill.on("error", () => {
          /*
           * Nothing left to kill, or the daemon is unreachable. The
           * grace timer below is the backstop.
           */
        });
      };

      function enforceLimit() {
        killAllUserProcesses();

        if (graceTimer === null) {
          graceTimer = setTimeout(abandon, KILL_GRACE_MS);
        }
      }

      child.stderr.on("data", (data: Buffer) => {
        stderrBytes += data.length;

        if (
          stderrBytes > MAX_OUTPUT_BYTES &&
          !outputExceeded
        ) {
          outputExceeded = true;
          enforceLimit();
        }

        stderr = this.appendOutputPreview(
          stderr,
          data,
          MAX_STORED_OUTPUT_BYTES,
        );
      });

      child.stdout.on("data", (data: Buffer) => {
        stdoutBytes += data.length;

        if (
          stdoutBytes > MAX_OUTPUT_BYTES &&
          !outputExceeded
        ) {
          outputExceeded = true;
          enforceLimit();
        }

        stdout = this.appendOutputPreview(
          stdout,
          data,
          MAX_STORED_OUTPUT_BYTES,
        );
      });

      child.on("error", (error) => {
        fail(error);
      });

      /*
       * IMPORTANT:
       *
       * A submitted program may exit before consuming stdin, so
       * Docker's stdin pipe can emit EPIPE. That must NOT crash the
       * worker.
       */
      child.stdin.on("error", () => {
        // Expected when the child exits before consuming stdin.
      });

      const finishWith = async (exitCode: number | null) => {
        if (settled) {
          return;
        }

        /*
         * The program has already exited, so the time limit no longer
         * applies. Stop the timer BEFORE the await below: isOOMKilled
         * shells out to `docker inspect`, and if that is slow the timer
         * would otherwise fire during the await and flip `timedOut` on
         * a run that finished well within its limit.
         */
        if (limitTimer) {
          clearTimeout(limitTimer);
          limitTimer = null;
        }

        /*
         * Only consult Docker's OOM state when the limits we enforce
         * ourselves were not hit: on TLE/OLE the 137 exit code is our
         * own SIGKILL, and the container's OOMKilled flag is sticky,
         * so trusting it there would mislabel TLE/OLE as MLE.
         *
         * Docker's OOMKilled is authoritative for MLE; a bare exit
         * code of 137 is never sufficient on its own.
         */
        const memoryExceeded =
          !timedOut &&
          !outputExceeded &&
          (await this.isOOMKilled(
            sandbox.containerName,
          ));

        settle(exitCode, memoryExceeded);
      };

      /*
       * KNOWN BEHAVIOUR: if the submitted program exits but leaves a
       * background child holding stdout, the `docker exec` CLI stays
       * attached and neither `exit` nor `close` fires here. Such a
       * submission runs out its time limit and is reported TLE.
       *
       * That is the safe direction to fail — the process tree really
       * did not terminate within the limit — and the time-limit timer
       * above still guarantees we settle. Settling early instead would
       * risk truncating output that is still in flight.
       */
      child.on("close", (exitCode) => {
        void finishWith(exitCode);
      });

      child.stdin.write(stdin);
      child.stdin.end();
    });
  }
  /**
   * Destroys the Docker container and removes
   * the host-side execution directory.
   */
  async destroySandbox(
    sandbox: Sandbox,
  ): Promise<void> {
    console.log(
      `[Sandbox] Destroying ${sandbox.containerName}`,
    );

    try {
      await this.removeContainer(
        sandbox.containerName,
      );

      console.log(
        `[Sandbox] Container removed: ${sandbox.containerName}`,
      );
    } catch (error) {
      console.error(
        `[Sandbox] Failed to remove container ${sandbox.containerName}`,
        error,
      );
    }

    /*
     * Host-side cleanup must happen independently
     * of Docker cleanup.
     */
    try {
      await fs.rm(
        sandbox.executionDir,
        {
          recursive: true,
          force: true,
        },
      );

      console.log(
        `[Sandbox] Directory removed: ${sandbox.executionDir}`,
      );
    } catch (error) {
      console.error(
        `[Sandbox] Failed to remove directory`,
        error,
      );
    }
  }

  /**
   * Starts one persistent sandbox container.
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
        /*
         * Detached mode.
         *
         * Docker starts the container and immediately
         * returns control to Node.
         */
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

        /*
         * Without an explicit swap limit Docker grants swap equal to
         * --memory, so a program could use 2x the intended memory and
         * escape MLE detection entirely.
         */
        "--memory-swap",
        `${memoryLimitMb}m`,

        "--cpus",
        "0.5",

        "--read-only",

        /*
         * /tmp must be writable and executable for the Java and C++
         * compile outputs. Bounding its size keeps a runaway program
         * from filling the tmpfs; the pages are charged to this
         * container's memory cgroup either way.
         */
        "--tmpfs",
        `/tmp:exec,size=${memoryLimitMb}m`,

        "--cap-drop",
        "ALL",

        /*
         * These images still ship setuid-root binaries (e.g.
         * /usr/bin/passwd). --cap-drop ALL empties the bounding set but
         * does not stop the uid transition itself; no-new-privileges
         * does, so user code cannot become uid 0 inside the sandbox.
         */
        "--security-opt",
        "no-new-privileges",

        /*
         * Lets the startup reaper recognise judge-owned containers
         * without pattern-matching names.
         */
        "--label",
        `${JUDGE_CONTAINER_LABEL}=1`,

        "-v",
        `${executionDir}:/sandbox:ro`,

        /*
         * Override the image's normal ENTRYPOINT.
         *
         * Otherwise run.sh would execute main script immediately.
         */
        "--entrypoint",
        "sleep",

        config.image,

        "infinity",
      ]);

      let stdout = "";
      let stderr = "";

      docker.stdout.on("data", (data) => {
        stdout += data.toString();
      });

      docker.stderr.on("data", (data) => {
        stderr += data.toString();
      });

      docker.on("error", (error) => {
        reject(error);
      });

      docker.on("close", (exitCode) => {
        if (exitCode !== 0) {
          reject(
            new Error(
              `Failed to start sandbox: ${stderr}`,
            ),
          );

          return;
        }

        /*
         * Docker -d returns the container ID.
         *
         * At this point the container has been started
         * in the background.
         */
        resolve();
      });
    });
  }

  /**
   * Checks Docker's OOMKilled state.
   *
   * Authoritative source for MLE. Bounded by DOCKER_AUX_TIMEOUT_MS so
   * an unresponsive daemon degrades to "not OOM" instead of hanging
   * the worker; the resulting verdict is then RE rather than MLE,
   * which is the safe direction to fail.
   */
  private isOOMKilled(
    containerName: string,
  ): Promise<boolean> {
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
        if (done) {
          return;
        }

        done = true;
        clearTimeout(timer);
        resolve(value);
      };

      const timer = setTimeout(() => {
        try {
          inspect.kill("SIGKILL");
        } catch {
          // Already gone.
        }

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
   * Removes every sandbox container left behind by a previous worker
   * process. `finally` blocks do not run when a process is SIGKILLed
   * or its host dies, so without this a crash leaks containers until
   * the host runs out of resources.
   *
   * Scoped strictly to containers carrying this judge's own label, so
   * unrelated containers on a shared host are never touched.
   *
   * ASSUMES one judge worker per Docker host: it cannot distinguish a
   * dead worker's containers from a live sibling replica's. Run it at
   * startup only, and do not enable it on a host running several
   * worker replicas against the same daemon.
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
        if (done) {
          return;
        }

        done = true;
        clearTimeout(timer);
        resolve(value);
      };

      const timer = setTimeout(() => {
        try {
          list.kill("SIGKILL");
        } catch {
          // Already gone.
        }

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
        console.error(
          `[Reaper] Failed to remove ${name}`,
          error,
        );
      }
    }

    /*
     * Host-side execution directories are named after the container's
     * execution id, so anything still present belongs to a dead run.
     *
     * Clear the CONTENTS rather than baseDir itself: in the deployed
     * topology JUDGE_WORK_DIR is a bind mount, and removing a mount
     * point fails with EBUSY — which silently defeated this cleanup and
     * let stale directories accumulate indefinitely.
     */
    let entries: string[] = [];

    try {
      entries = await fs.readdir(this.baseDir);
    } catch (error) {
      const code = (error as NodeJS.ErrnoException).code;

      /*
       * Nothing staged yet on a first run.
       */
      if (code !== "ENOENT") {
        console.error(
          "[Reaper] Failed to list execution directories",
          error,
        );
      }
    }

    for (const entry of entries) {
      try {
        await fs.rm(path.join(this.baseDir, entry), {
          recursive: true,
          force: true,
        });
      } catch (error) {
        console.error(
          `[Reaper] Failed to remove execution directory ${entry}`,
          error,
        );
      }
    }

    return reaped;
  }

  /**
   * Removes a container safely.
   */
  private removeContainer(
    containerName: string,
  ): Promise<void> {
    return new Promise((resolve, reject) => {
      console.log(
        `[Docker] Removing container: ${containerName}`,
      );

      const remove = spawn("docker", [
        "rm",
        "-f",
        containerName,
      ]);

      let stdout = "";
      let stderr = "";
      let done = false;

      /*
       * Cleanup must not be able to hang a shutdown path.
       */
      const timer = setTimeout(() => {
        if (done) {
          return;
        }

        done = true;

        try {
          remove.kill("SIGKILL");
        } catch {
          // Already gone.
        }

        reject(
          new Error(
            `docker rm timed out for ${containerName}`,
          ),
        );
      }, DOCKER_AUX_TIMEOUT_MS);

      remove.stdout.on("data", (data) => {
        stdout += data.toString();
      });

      remove.stderr.on("data", (data) => {
        stderr += data.toString();
      });

      remove.on("error", (error) => {
        if (done) {
          return;
        }

        done = true;
        clearTimeout(timer);
        reject(error);
      });

      remove.on("close", (exitCode) => {
        if (done) {
          return;
        }

        done = true;
        clearTimeout(timer);

        /*
         * Container already disappeared.
         *
         * That's still a successful cleanup state.
         */
        if (
          exitCode === 0 ||
          stderr.includes("No such container")
        ) {
          resolve();
          return;
        }

        reject(
          new Error(
            `docker rm failed with exit code ${exitCode}: ${stderr.trim()}`,
          ),
        );
      });
    });
  }
}