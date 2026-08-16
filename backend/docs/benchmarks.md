# Judge benchmarks and security measurements

All numbers here are measured, not estimated. Each section records the
environment, the exact command, and the raw result so a later run can be
compared like for like.

**Scope warning:** every measurement below was taken on a local macOS /
Docker Desktop host (`linux/arm64`). Production runs `linux/amd64` on a
VPS. These are baselines for regression comparison on the same machine —
they are **not** production figures. See
[Not verified](#not-verified-on-production) at the end.

---

## Environment

| | |
| --- | --- |
| Host OS | macOS 26.6.1 |
| Host arch | `arm64` (Apple silicon) |
| Docker | 29.3.1 |
| Docker daemon | `docker-desktop`, `aarch64`, 10 CPU, 8.22 GB RAM |
| Worker image | built from `docker/judge/worker.Dockerfile`, `arm64/linux` |
| Node in image | v22.23.2 |
| Worker bundle | `dist/judge-worker.js`, 2,390,678 bytes |
| Commit | `6ec9181` |
| Date measured | 2026-08-16 |

---

## 1. Worker startup baseline

### What is measured

Time from the container's own `State.StartedAt` to the timestamp the
worker stamps on its `"judge worker ready"` log line. This isolates
application startup — Prisma client init, Redis connect, the startup
sandbox reaper, the stranded-submission sweep, and BullMQ `Worker`
construction — and excludes image pull and `docker` CLI overhead.

### Setup

Production-compatible: the real production Dockerfile, the same two bind
mounts as `docker/judge/docker-compose.yml` (Docker socket +
`JUDGE_WORK_DIR`), against a throwaway Postgres and Redis.

```bash
docker build -f docker/judge/worker.Dockerfile -t codeclash-judge-worker:bench .

docker run -d --name judge-bench-worker \
  --network judge-bench-net \
  -e NODE_ENV=production \
  -e DATABASE_URL="postgresql://judge:judge@judge-test-db:5432/judge" \
  -e REDIS_URL="redis://judge-bench-redis:6379" \
  -e JUDGE_WORK_DIR=/tmp/algoriumx \
  -e JUDGE_CONCURRENCY=1 \
  ... (env required by src/config/env.ts) \
  -v /var/run/docker.sock:/var/run/docker.sock \
  -v /tmp/algoriumx:/tmp/algoriumx \
  codeclash-judge-worker:bench
```

Startup time is then computed from:

```bash
docker inspect -f '{{.State.StartedAt}}' judge-bench-worker
docker logs judge-bench-worker | grep '"msg":"judge worker ready"'
```

### Result — 7 consecutive cold container starts

| Run | Startup |
| --- | --- |
| 1 | 205 ms |
| 2 | 128 ms |
| 3 | 127 ms |
| 4 | 141 ms |
| 5 | 141 ms |
| 6 | 130 ms |
| 7 | 142 ms |

| Metric | Value |
| --- | --- |
| samples | 7 |
| min | **127 ms** |
| median | **141 ms** |
| mean | 144 ms |
| max | 205 ms |

Run 1 is a cold-cache outlier; runs 2–7 sit in a 127–142 ms band.

**Baseline for regression: median ≈ 141 ms.** A jump well beyond ~205 ms
suggests something was added to the startup path (an extra migration
check, a slower reaper, a new connection).

---

## 2. Fork-bomb containment

### Program

```python
import os
while True:
    try:
        os.fork()
    except Exception:
        pass
```

Run with `timeLimitMs=5000`, `memoryLimitMb=256`, against a sandbox with
`--pids-limit 100`.

### Result (local Docker Desktop VM)

| Phase | loadavg | processes in VM |
| --- | --- | --- |
| before | 0.36 0.31 0.17 | 198 |
| during | 0.86 0.42 0.21 | 298 |
| after | 0.86 0.42 0.21 | 198 |

| Check | Result |
| --- | --- |
| Verdict | `timedOut=true` → TLE |
| Termination | 8011 ms (5000 ms limit + 3000 ms kill grace) |
| Process growth | +100 exactly — capped by `--pids-limit 100` |
| Surviving children | none (container already gone) |
| Leftover sandbox containers | none |
| `/tmp/algoriumx` leftovers | 0 entries |
| Host responsive | `docker ps` returned in 23 ms during/after |

### Interpretation

Containment holds: the bomb is capped at the PID limit, the VM's process
count returns exactly to baseline, and the host stays responsive.

One detail worth recording: `exitCode=null` at 8011 ms means this took
the **`abandon()` fallback path**, not the fast kill. Under fork-bomb
load `kill -KILL -1` did not let `docker exec` close inside the 3 s
grace window, so the sandbox was marked poisoned and force-removed by
`destroySandbox`. The outcome is correct and nothing leaks, but a fork
bomb costs `timeLimit + 3 s` rather than terminating promptly — worth
knowing when sizing judge throughput.

---

## Not verified on production

The fork-bomb test has **not** been run on the production VPS. This
machine has no route to it: no remote Docker context, `DOCKER_HOST`
unset, no `~/.ssh/config`, no SSH keys, and the only reachable daemon
has `Swarm: inactive`. The numbers above are local-VM figures on
`arm64`; the production host is `amd64` with different core count and
memory, so both the startup baseline and the fork-bomb load figures must
be re-measured there before being treated as production characteristics.

To reproduce on the VPS, run the same fork-bomb submission through a
disposable submission and record the same table.
