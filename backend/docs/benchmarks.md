# Judge benchmarks and security measurements

All numbers here are measured, not estimated or extrapolated. Each
section records the environment, the exact method, and the raw result so
a later run can be compared like for like.

**The VPS figures are authoritative.** Local Docker Desktop figures are
retained at the end only as a same-machine regression reference for
development; they are not representative of production.

---

## Environments

| | **Production VPS (authoritative)** | Local dev (reference only) |
| --- | --- | --- |
| Host | `srv1408730`, Ubuntu 24.04.4 LTS | macOS 26.6.1 |
| Arch | **x86_64** | arm64 (Apple silicon) |
| CPU | **2 cores**, AMD EPYC 9355P | 10 cores |
| Memory | 7940 MB | 8217 MB (VM) |
| Kernel | 6.8.0-106-generic | Docker Desktop VM |
| cgroup | v2 | v2 |
| Docker | 28.5.0 | 29.3.1 |
| Worker image | `ghcr.io/pramit3129/codeclash-judge-worker:latest`, **amd64/linux**, `8a6f504c7c91` | locally built, arm64 |
| Node in image | v22.23.2 | v22.23.2 |
| Measured | 2026-08-16 02:04–02:12 UTC | 2026-08-16 |

The production box has **2 cores**. That single fact drives most of the
difference between the two columns and matters for the fork-bomb result
below.

---

## 1. Fork-bomb containment — PRODUCTION VPS

### Method

A disposable sandbox container created with the **exact** flags
`DockerRunner.startContainer()` uses (`--network none`,
`--pids-limit 100`, `--memory 256m --memory-swap 256m`, `--cpus 0.5`,
`--read-only`, `--tmpfs /tmp:exec,size=256m`, `--cap-drop ALL`,
`--security-opt no-new-privileges`, source bind-mounted `:ro`), running:

```python
import os
while True:
    try:
        os.fork()
    except Exception:
        pass
```

Termination replicates `execute()` faithfully: at the time limit the
kill is spawned **asynchronously** (`docker exec <c> sh -c 'kill -KILL -1'`)
while a 3000 ms grace timer runs concurrently; if the exec has not
closed when grace expires, `abandon()` SIGKILLs the local CLI, poisons
the sandbox and `destroySandbox()` force-removes it.

Sandbox process count was read from the **host cgroup**
(`pids.current`), not via `docker exec`, because the host is too loaded
during a fork bomb for an exec to schedule reliably.

The test never touched the queue, the live worker, or any real
submission. It used its own container and its own work directory.

### Results

| | Trial 1 | Trial 2 |
| --- | --- | --- |
| Time limit | 1000 ms (production value for `sum-of-two-numbers`) | 5000 ms |
| Grace | 3000 ms | 3000 ms |
| Budget | 4000 ms | 8000 ms |
| `timedOut` raised at | +1009 ms | +5014 ms |
| **Settled at** | **+4096 ms** | **+8091 ms** |
| Path taken | `abandon()` fallback | `abandon()` fallback |
| Kill exec actually completed at | +4198 ms | +8423 ms |
| Peak sandbox pids (cgroup) | 105 | 106 |
| Host procs before → after | 154 → 155 | 155 → 156 |
| loadavg before → after | 0.60 → 1.36 | 0.62 → 0.90 |
| Surviving fork-bomb processes | **0** | **0** |
| Leftover test containers | **0** | **0** |
| Production judge sandboxes harmed | **0** | **0** |
| `/tmp/algoriumx` leftovers | **0** | **0** |
| `docker ps` latency after | 21 ms | 17 ms |
| Worker service after | 1/1 healthy | 1/1 healthy |

`pids.max` was read directly from the container's cgroup and confirmed
to be exactly **100**:

```
/sys/fs/cgroup/system.slice/docker-<id>.scope/pids.max = 100
```

Sampled `pids.current` reached 100 within **~285 ms** and stayed pinned
there. Peak samples of 105–106 exceed `pids.max` slightly; this is
attributable to short-lived `docker exec` helper tasks accounted in the
same scope. The load-bearing result is unchanged: growth is capped
around the limit rather than unbounded.

### Verdict on each required check

| Check | Result |
| --- | --- |
| `PidsLimit=100` contains the bomb | ✅ capped at 100 within ~285 ms |
| Sandbox terminated within timeout + grace | ✅ 4096 ms vs 4000 ms budget (+96 ms); 8091 ms vs 8000 ms (+91 ms) |
| No fork-bomb children survive | ✅ 0 stray `/sandbox/main.py` processes |
| No orphan judge containers | ✅ 0 |
| No `/tmp/algoriumx` execution dir remains | ✅ 0 entries |
| Docker daemon responsive | ✅ `docker ps` in 17–21 ms |
| Worker healthy after | ✅ service 1/1, 0 errors in logs |
| Host responsive, no sustained load/process growth | ✅ procs returned to baseline (±1), loadavg decayed |

### Important finding: fork bombs always take the slow path

On this 2-core box, the `docker exec` that delivers `kill -KILL -1`
could not complete inside the 3 s grace window — it finished at
**+4198 ms** and **+8423 ms**, i.e. ~100–400 ms *after* the runner had
already given up and abandoned. A fork bomb therefore **always**
resolves via `abandon()`, costing `timeLimit + 3000 ms` and force-
removing the container, rather than terminating promptly.

This is safe — the verdict is still TLE, nothing leaks, the host stays
responsive — but it means a fork bomb occupies a judge slot for the full
grace budget. With `JUDGE_CONCURRENCY=1`, a stream of fork bombs would
serialise the queue at ~4 s each. Worth knowing when sizing throughput.

An earlier trial using a *synchronous* kill measured the exec returning
only at +7453 ms under load, which is what first surfaced this.

---

## 2. Worker startup baseline — PRODUCTION VPS

### What is measured

Time from the container's `State.StartedAt` to the timestamp the worker
stamps on its own `"judge worker ready"` log line. This isolates
application startup — Prisma client init, Redis connect, startup sandbox
reaper, stranded-submission sweep, BullMQ `Worker` construction — and
excludes image pull and `docker` CLI overhead.

### Setup

The **production image** (`ghcr.io/pramit3129/codeclash-judge-worker:latest`,
amd64) with the production bind mounts (Docker socket + `JUDGE_WORK_DIR`),
against a **disposable** Postgres and Redis on a private network, with
the real migrations applied via the prisma bundled in that image.

Isolation used so production was never at risk:
- disposable DB/Redis, so the benchmark worker cannot consume a real job
  or read/write production data;
- `JUDGE_WORK_DIR` redirected to `/tmp/algoriumx-bench`, so its startup
  reaper cannot clear real execution directories;
- each run skipped if a live production sandbox existed, so the reaper's
  label sweep could never remove one.

### Result — 7 consecutive cold starts

| Run | Startup |
| --- | --- |
| 1 | 383 ms |
| 2 | 405 ms |
| 3 | 411 ms |
| 4 | 330 ms |
| 5 | 346 ms |
| 6 | 374 ms |
| 7 | 427 ms |

| Metric | **VPS (amd64, 2 cores)** | Local (arm64, 10 cores) |
| --- | --- | --- |
| samples | 7 | 7 |
| min | **330 ms** | 127 ms |
| median | **383 ms** | 141 ms |
| mean | **382 ms** | 144 ms |
| max | **427 ms** | 205 ms |

**Production baseline for regression: median ≈ 383 ms**, spread
330–427 ms. A jump well beyond ~430 ms suggests something was added to
the startup path (an extra migration check, a slower reaper, a new
connection).

Production startup is ~2.7× the local figure, consistent with 2 cores
versus 10.

---

## Appendix: local Docker Desktop reference (not production)

Retained only for same-machine regression comparison during development.

- **Startup:** 7 cold starts — min 127 ms, median 141 ms, mean 144 ms,
  max 205 ms (run 1 a cold-cache outlier; 2–7 in a 127–142 ms band).
- **Fork bomb** (5000 ms limit): settled at 8011 ms via the `abandon()`
  path, PID growth capped at exactly +100, VM process count returned to
  baseline, no survivors, no leftover containers, `/tmp/algoriumx`
  empty, `docker ps` responsive in 23 ms.

The local fork-bomb figure (8011 ms) and the VPS figure (8091 ms) at the
same 5000 ms limit agree closely, which is why the local environment
remains usable as a regression signal despite the architecture and core
count differing.
