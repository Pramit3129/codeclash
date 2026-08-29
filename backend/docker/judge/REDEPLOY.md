# Redeploy notes — compile-budget change

Supplement to the standard worker deployment runbook, for the change in
`docker.runner.ts`, `language.config.ts`, and `docker/judge/docker-compose.yml`.

Follow the normal runbook steps (build `linux/amd64` with buildx → push to GHCR
→ `docker pull` on the VPS → `docker service update` → verify). Nothing about
that flow changes. What follows is only what is specific to this change.

No database migration. No schema change. Rollback is a Swarm rollback.

---

## Does anything extra need doing?

**No, if you accept the defaults.** All four new settings are compiled into the
image with working defaults, so the standard image-update flow makes the fix
live:

```bash
docker service update --image ghcr.io/pramit3129/codeclash-judge-worker:latest codeclash-judge-yhgaa9_judge-worker
```

**Yes, if you want to tune them.** `docker service update --image` only swaps
the image — Swarm does not re-read the stack file, so the env block added to
`docker/judge/docker-compose.yml` will **not** reach the running service. Either
redeploy the stack through Dokploy so the compose change is applied, or set them
directly on the service (see below).

---

## Sizing — decide before deploying

Compilation is the peak. A sandbox now starts at `JUDGE_COMPILE_MEMORY_MB`,
then drops to the problem's limit before user code runs.

```
worst-case judge RAM  =  JUDGE_COMPILE_MEMORY_MB x JUDGE_CONCURRENCY
```

At defaults (768 MB, concurrency 1) that is ~768 MB peak, plus the worker
process (~150 MB). Check headroom on the VPS first:

```bash
free -m
```

Measured on `algoriumx-judge-cpp:1`, `g++ -std=c++20 -O2` on a
`#include <bits/stdc++.h>` program:

| Limit  | Result                                                |
| ------ | ----------------------------------------------------- |
| 256 MB | OOM-killed (`cc1plus` killed) at any tmpfs size        |
| 320 MB | compiles                                              |
| 768 MB | compiles in ~1s — default, headroom for heavy templates |

Do not go below 512 MB. That test program is trivial; template-heavy contest
code needs considerably more. On a 1 GB VPS use 512.

---

## Overriding the defaults

Only if the defaults do not suit the box. Applied as a service update, this
also triggers the rolling restart, so it can replace the plain `--image` step:

```bash
docker service update --image ghcr.io/pramit3129/codeclash-judge-worker:latest --env-add JUDGE_COMPILE_MEMORY_MB=512 codeclash-judge-yhgaa9_judge-worker
```

Available settings:

| Variable                   | Default | Applies to                       |
| -------------------------- | ------- | -------------------------------- |
| `JUDGE_COMPILE_MEMORY_MB`  | 768     | compile phase only               |
| `JUDGE_COMPILE_CPUS`       | 2       | compile phase only               |
| `JUDGE_RUNTIME_CPUS`       | 0.5     | user code                        |
| `JUDGE_TMPFS_MB`           | 128     | sandbox `/tmp`, build output     |

`JUDGE_RUNTIME_CPUS` was hardcoded to `0.5` before and still defaults there.
Raising it loosens every problem's effective time limit — change it only
alongside re-tuning those limits.

Prefer setting these in the stack definition rather than with `--env-add`, so
they survive the next stack deploy.

---

## Verification specific to this change

The standard log checks (`Redis connected`, `judge worker ready`) still apply.
Beyond those:

**1. The bug is fixed.** Submit a C++ solution using `#include <bits/stdc++.h>`.
It must come back Accepted, not Compilation Error.

**2. The limit is actually narrowed.** This is the security-relevant check — if
narrowing silently fails, user code runs with the compiler's headroom and MLE
stops firing. While a C++ submission is judging:

```bash
docker inspect -f '{{.Name}} mem={{.HostConfig.Memory}}' $(docker ps -q --filter "label=com.algoriumx.judge")
```

During execution this must read `268435456` (256 MB) for a 256 MB problem — not
the compile budget. If it shows the compile budget, roll back.

**3. MLE still fires.** Submit a program that allocates past the problem's
limit. It must return MLE, not Accepted.

---

## Rollback

Swarm keeps the previous service spec:

```bash
docker service rollback codeclash-judge-yhgaa9_judge-worker
```

No data migration is involved, so this is immediate and safe.

---

## Notes

- **In-flight jobs.** The rolling update stops the old task before starting the
  new one. BullMQ redelivers anything that was mid-judge, so a submission is
  delayed rather than lost.
- **Sandbox hardening is unchanged** — `--network none`, `--cap-drop ALL`,
  `--read-only`, `no-new-privileges`, `--pids-limit 100`. The compile budget is
  only ever held while the compiler runs on source text; user code never
  executes at it.
- **tmpfs** is now fixed at `JUDGE_TMPFS_MB` rather than tracking the problem's
  memory limit, and mounts `nosuid,nodev`. Problems with limits below ~64 MB
  previously had a tmpfs too small to hold a compiled binary.
- **Leaked sandboxes.** If the worker is killed mid-judge, sandbox containers
  can survive on the host. To sweep:
  `docker rm -f $(docker ps -aq --filter "label=com.algoriumx.judge")`
