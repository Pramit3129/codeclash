/**
 * Sandbox containment tests.
 *
 * Each case here corresponds to a defect that was found by probing the
 * running judge, not to a hypothetical. The two that mattered most:
 *
 *  - a submitted program could rewrite the PID file the runner used to
 *    enforce TLE, making the kill a no-op and hanging the worker forever
 *    (a three-line denial of service against the whole judge);
 *  - killing only the recorded PID left forked children alive.
 *
 * Requires Docker and the four judge images.
 */
import { describe, expect, test, afterAll } from "bun:test";
import { spawnSync } from "node:child_process";

import {
  DockerRunner,
  JUDGE_CONTAINER_LABEL,
  type Sandbox,
} from "../docker.runner.ts";

import type { RunRequest } from "../runner.type.ts";

const runner = new DockerRunner();

const TIME_LIMIT_MS = 2_000;

/*
 * Generous enough to absorb Docker overhead, tight enough that a genuine
 * hang fails the test rather than stalling the suite.
 */
const SETTLE_BUDGET_MS = 8_000;

const request = (over: Partial<RunRequest> = {}): RunRequest => ({
  language: "python",
  sourceCode: "",
  stdin: "",
  timeLimitMs: TIME_LIMIT_MS,
  memoryLimitMb: 256,
  ...over,
});

const openSandboxes = new Set<Sandbox>();

async function withSandbox<T>(
  req: RunRequest,
  fn: (sandbox: Sandbox) => Promise<T>,
): Promise<T> {
  const sandbox = await runner.createSandbox(req);
  openSandboxes.add(sandbox);

  try {
    return await fn(sandbox);
  } finally {
    await runner.destroySandbox(sandbox);
    openSandboxes.delete(sandbox);
  }
}

function processesIn(containerName: string): string {
  const result = spawnSync(
    "docker",
    [
      "exec",
      containerName,
      "sh",
      "-c",
      'for p in /proc/[0-9]*; do cat $p/cmdline 2>/dev/null | tr "\\0" " "; echo; done',
    ],
    { encoding: "utf8" },
  );

  return result.stdout ?? "";
}

afterAll(async () => {
  for (const sandbox of openSandboxes) {
    await runner.destroySandbox(sandbox).catch(() => {});
  }
});

describe("worker liveness under hostile submissions", () => {
  test(
    "a program that rewrites the runner's PID file still hits TLE",
    async () => {
      const req = request({
        sourceCode: `
import glob
for f in glob.glob("/tmp/exec-*.pid"):
    open(f, "w").write("999999")
while True:
    pass`,
      });

      const { result, elapsed } = await withSandbox(req, async (sandbox) => {
        const started = Date.now();
        const result = await runner.execute(sandbox, req, "");
        return { result, elapsed: Date.now() - started };
      });

      expect(result.timedOut).toBe(true);
      expect(elapsed).toBeLessThan(SETTLE_BUDGET_MS);

      // Our own SIGKILL must never be reported as an OOM.
      expect(result.memoryExceeded).toBe(false);
    },
    30_000,
  );

  test(
    "a program that spawns a child leaves nothing running after TLE",
    async () => {
      const req = request({
        sourceCode: `
import subprocess
subprocess.Popen(["sleep", "300"])
while True:
    pass`,
      });

      await withSandbox(req, async (sandbox) => {
        const result = await runner.execute(sandbox, req, "");
        expect(result.timedOut).toBe(true);

        expect(processesIn(sandbox.containerName)).not.toContain("sleep 300");
      });
    },
    30_000,
  );

  test(
    "forked children are all reaped on TLE",
    async () => {
      const req = request({
        sourceCode: `
import os, time
for _ in range(8):
    if os.fork() == 0:
        time.sleep(300)
        os._exit(0)
while True:
    pass`,
      });

      await withSandbox(req, async (sandbox) => {
        const result = await runner.execute(sandbox, req, "");
        expect(result.timedOut).toBe(true);

        const survivors =
          processesIn(sandbox.containerName).match(/sleep 300/g) ?? [];

        expect(survivors).toHaveLength(0);
      });
    },
    30_000,
  );

  test(
    "a program cannot stop its own sandbox by killing PID 1",
    async () => {
      const req = request({
        sourceCode: `
import os
try:
    os.kill(1, 9)
except Exception as e:
    print("kill failed:", e)
print("still alive")`,
      });

      await withSandbox(req, async (sandbox) => {
        const result = await runner.execute(sandbox, req, "");

        expect(result.exitCode).toBe(0);
        expect(result.stdout).toContain("still alive");
      });
    },
    30_000,
  );

  test(
    "execute() refuses to reuse a poisoned sandbox",
    async () => {
      const req = request({ sourceCode: "print(1)" });

      await withSandbox(req, async (sandbox) => {
        sandbox.poisoned = true;

        await expect(
          runner.execute(sandbox, req, ""),
        ).rejects.toThrow(/poisoned/);
      });
    },
    30_000,
  );
});

describe("sandbox isolation", () => {
  test(
    "runs as a non-root user and cannot escalate via setuid binaries",
    async () => {
      const req = request({
        sourceCode: `
import subprocess
print(subprocess.run(["id"], capture_output=True, text=True).stdout.strip())`,
      });

      await withSandbox(req, async (sandbox) => {
        const result = await runner.execute(sandbox, req, "");

        expect(result.stdout).toContain("uid=1000");
        expect(result.stdout).not.toContain("uid=0");
      });
    },
    30_000,
  );

  test(
    "has no network access to the internet, localhost or the host gateway",
    async () => {
      const req = request({
        timeLimitMs: 15_000,
        sourceCode: `
import socket
socket.setdefaulttimeout(2)
for target in [("1.1.1.1", 53), ("127.0.0.1", 6379), ("172.17.0.1", 5432)]:
    try:
        socket.create_connection(target, 2)
        print("REACHED", target)
    except Exception:
        print("blocked", target)`,
      });

      await withSandbox(req, async (sandbox) => {
        const result = await runner.execute(sandbox, req, "");
        expect(result.stdout).not.toContain("REACHED");
      });
    },
    40_000,
  );

  test(
    "cannot see the Docker socket",
    async () => {
      const req = request({
        sourceCode: `
import os
print("socket:", os.path.exists("/var/run/docker.sock"))`,
      });

      await withSandbox(req, async (sandbox) => {
        const result = await runner.execute(sandbox, req, "");
        expect(result.stdout).toContain("socket: False");
      });
    },
    30_000,
  );

  test(
    "cannot write outside /tmp, including its own source file",
    async () => {
      const req = request({
        sourceCode: `
for p in ["/sandbox/main.py", "/etc/passwd", "/usr/local/bin/run.sh", "/main.py"]:
    try:
        open(p, "a").write("x")
        print("WROTE", p)
    except Exception:
        print("blocked", p)`,
      });

      await withSandbox(req, async (sandbox) => {
        const result = await runner.execute(sandbox, req, "");
        expect(result.stdout).not.toContain("WROTE");
      });
    },
    30_000,
  );
});

describe("resource limits", () => {
  test(
    "memory exhaustion is MLE, distinct from TLE",
    async () => {
      const req = request({
        memoryLimitMb: 64,
        timeLimitMs: 5_000,
        sourceCode: `
chunks = []
while True:
    chunks.append("A" * (10 * 1024 * 1024))`,
      });

      await withSandbox(req, async (sandbox) => {
        const result = await runner.execute(sandbox, req, "");

        expect(result.memoryExceeded).toBe(true);
        expect(result.timedOut).toBe(false);
      });
    },
    30_000,
  );

  test(
    "runaway output is OLE, is killed, and stays bounded in memory",
    async () => {
      const req = request({
        sourceCode: `
while True:
    print("A" * 100000)`,
      });

      await withSandbox(req, async (sandbox) => {
        const result = await runner.execute(sandbox, req, "");

        expect(result.outputExceeded).toBe(true);

        // Execution stops; it is not merely truncated.
        expect(result.memoryExceeded).toBe(false);

        // Only a preview is retained, so the worker heap cannot be grown.
        expect(Buffer.byteLength(result.stdout, "utf8")).toBeLessThanOrEqual(
          4 * 1024,
        );
      });
    },
    30_000,
  );

  test(
    "stderr is bounded independently of stdout",
    async () => {
      const req = request({
        sourceCode: `
import sys
while True:
    sys.stderr.write("E" * 100000)`,
      });

      await withSandbox(req, async (sandbox) => {
        const result = await runner.execute(sandbox, req, "");

        expect(result.outputExceeded).toBe(true);
        expect(Buffer.byteLength(result.stderr, "utf8")).toBeLessThanOrEqual(
          4 * 1024,
        );
      });
    },
    30_000,
  );

  test(
    "a program that never reads stdin does not crash the worker (EPIPE)",
    async () => {
      const req = request({ sourceCode: `print("hello")` });

      await withSandbox(req, async (sandbox) => {
        const result = await runner.execute(sandbox, req, "2 3\n");

        expect(result.exitCode).toBe(0);
        expect(result.stdout.trim()).toBe("hello");
      });
    },
    30_000,
  );
});

describe("cleanup", () => {
  test(
    "destroySandbox removes the container and its execution directory",
    async () => {
      const req = request({ sourceCode: "print(1)" });

      const sandbox = await runner.createSandbox(req);
      await runner.execute(sandbox, req, "");
      await runner.destroySandbox(sandbox);

      const listed = spawnSync(
        "docker",
        ["ps", "-a", "--filter", `name=^${sandbox.containerName}$`, "--format", "{{.Names}}"],
        { encoding: "utf8" },
      );

      expect((listed.stdout ?? "").trim()).toBe("");

      expect(
        await Bun.file(`${sandbox.executionDir}/main.py`).exists(),
      ).toBe(false);
    },
    30_000,
  );

  test(
    "the reaper clears execution directories without removing the work dir itself",
    async () => {
      const req = request({ sourceCode: "print(1)" });

      // Leaves the execution directory behind, as a crashed worker would.
      await runner.createSandbox(req);

      await runner.reapOrphanedSandboxes();

      /*
       * Regression: the reaper used to rm the work dir itself, which
       * fails with EBUSY when JUDGE_WORK_DIR is a bind mount — exactly
       * the deployed configuration — silently leaking every execution
       * directory. It must empty the directory and leave it in place.
       */
      const workDir = process.env.JUDGE_WORK_DIR ?? "/tmp/algoriumx";

      const { readdir } = await import("node:fs/promises");
      const remaining = await readdir(workDir).catch(() => null);

      expect(remaining).not.toBeNull();
      expect(remaining).toHaveLength(0);
    },
    60_000,
  );

  test(
    "the reaper removes labelled sandboxes but never unlabelled containers",
    async () => {
      const req = request({ sourceCode: "print(1)" });

      // A sandbox a crashed worker would have left behind.
      await runner.createSandbox(req);

      spawnSync("docker", ["rm", "-f", "judge-test-bystander"]);
      spawnSync("docker", [
        "run", "-d",
        "--name", "judge-test-bystander",
        "--entrypoint", "sleep",
        "algoriumx-judge-python:1", "infinity",
      ]);

      try {
        await runner.reapOrphanedSandboxes();

        const labelled = spawnSync(
          "docker",
          ["ps", "-a", "--filter", `label=${JUDGE_CONTAINER_LABEL}=1`, "--format", "{{.Names}}"],
          { encoding: "utf8" },
        );

        expect((labelled.stdout ?? "").trim()).toBe("");

        const bystander = spawnSync(
          "docker",
          ["ps", "-a", "--filter", "name=^judge-test-bystander$", "--format", "{{.Names}}"],
          { encoding: "utf8" },
        );

        expect((bystander.stdout ?? "").trim()).toBe("judge-test-bystander");
      } finally {
        spawnSync("docker", ["rm", "-f", "judge-test-bystander"]);
      }
    },
    60_000,
  );
});
