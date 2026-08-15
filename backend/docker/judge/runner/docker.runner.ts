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

export interface Sandbox {
  executionId: string;
  executionDir: string;
  containerName: string;
}

export class DockerRunner {
  private readonly baseDir = "/tmp/algoriumx";

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
      "main.py",
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
    });

    return {
      executionId,
      executionDir,
      containerName,
    };
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
   * Executes the user's program for ONE test case
   * inside an already-running sandbox.
   */
  async execute(
    sandbox: Sandbox,
    request: RunRequest,
    stdin: string,
  ): Promise<RunResult> {
    let stdout = "";
    let stderr = "";

    let timedOut = false;
    let outputExceeded = false;

    const MAX_OUTPUT_BYTES = 1024 * 1024;
    const MAX_STORED_OUTPUT_BYTES = 4 * 1024;
    let stdoutBytes = 0;
    let stderrBytes = 0;

    const process = spawn("docker", [
      "exec",
      "-i",

      sandbox.containerName,

      "python3",
      "/sandbox/main.py",
    ]);

    const killProcess = () => {
      const kill = spawn("docker", [
        "kill",
        sandbox.containerName,
      ]);

      kill.on("error", () => {
        /*
         * The container may already have stopped.
         */
      });
    };

    const timeout = setTimeout(() => {
      timedOut = true;

      killProcess();
    }, request.timeLimitMs);

    process.stderr.on("data", (data: Buffer) => {
      stderrBytes += data.length;

      if (
        stderrBytes > MAX_OUTPUT_BYTES &&
        !outputExceeded
      ) {
        outputExceeded = true;
        killProcess();
      }

      stderr = this.appendOutputPreview(
        stderr,
        data,
        MAX_STORED_OUTPUT_BYTES,
      );
    });

    process.stdout.on("data", (data: Buffer) => {
      stdoutBytes += data.length;

      if (
        stdoutBytes > MAX_OUTPUT_BYTES &&
        !outputExceeded
      ) {
        outputExceeded = true;
        killProcess();
      }

      stdout = this.appendOutputPreview(
        stdout,
        data,
        MAX_STORED_OUTPUT_BYTES,
      );
    });

    return new Promise((resolve, reject) => {
      process.on("error", (error) => {
        clearTimeout(timeout);

        reject(error);
      });

      process.on("close", async (exitCode) => {
        clearTimeout(timeout);

        /*
         * Only inspect OOM if this wasn't already
         * identified as TLE or OLE.
         */
        const memoryExceeded =
          !timedOut &&
          !outputExceeded &&
          await this.isOOMKilled(
            sandbox.containerName,
          );

        resolve({
          stdout,
          stderr,

          exitCode,

          timedOut,
          memoryExceeded,
          outputExceeded,
        });
      });

      process.stdin.write(stdin);
      process.stdin.end();
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
  }: {
    containerName: string;
    executionDir: string;
    memoryLimitMb: number;
  }): Promise<void> {
    return new Promise((resolve, reject) => {
      const docker = spawn("docker", [
        "run",

        /*
         * Detached mode.
         *
         * Docker starts the container and immediately
         * returns control to Node.
         */
        "-d",

        "--name",
        containerName,

        "--network",
        "none",

        "--pids-limit",
        "10",

        "--memory",
        `${memoryLimitMb}m`,

        "--cpus",
        "0.5",

        "--read-only",

        "--tmpfs",
        "/tmp",

        "--cap-drop",
        "ALL",

        "-v",
        `${executionDir}:/sandbox:ro`,

        /*
         * Override the image's normal ENTRYPOINT.
         *
         * Otherwise run.sh would execute main.py immediately.
         */
        "--entrypoint",
        "sleep",

        "algoriumx-judge-python:1",

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

      inspect.stdout.on("data", (data) => {
        output += data.toString();
      });

      inspect.on("error", () => {
        resolve(false);
      });

      inspect.on("close", () => {
        resolve(
          output.trim() === "true",
        );
      });
    });
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

      remove.stdout.on("data", (data) => {
        stdout += data.toString();
      });

      remove.stderr.on("data", (data) => {
        stderr += data.toString();
      });

      remove.on("error", (error) => {
        reject(error);
      });

      remove.on("close", (exitCode) => {
        console.log(
          `[Docker] rm exitCode=${exitCode}`,
        );

        console.log(
          `[Docker] stdout=${stdout}`,
        );

        console.log(
          `[Docker] stderr=${stderr}`,
        );

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
            `docker rm failed with exit code ${exitCode}: ${stderr}`,
          ),
        );
      });
    });
  }
}