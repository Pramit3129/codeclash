# Judge worker — redeploy

Two flows. Pick by what actually changed.

| What changed                        | Flow  | Build + push? | Where       |
| ----------------------------------- | ----- | ------------- | ----------- |
| Only limits / env vars (`JUDGE_*`)  | **A** | No            | VPS only    |
| Worker or runner code (`.ts`)       | **B** | Yes           | Local → VPS |

Neither involves a database migration. Rollback is a Swarm rollback.

Service: `codeclash-judge-yhgaa9_judge-worker`
Image: `ghcr.io/pramit3129/codeclash-judge-worker:latest`

Assumes VPS setup is already done — Docker daemon, socket binding,
`/tmp/algoriumx`, `dokploy-network`, and the four language judge images
(`python`, `javascript`, `java`, `cpp`) are persistent and are never re-run.

---

# Flow A — limits only

No build, no push, no pull. Env vars do not live in the image, so there is
nothing to ship. One command, on the VPS:

```bash
ssh <vps>
```

```bash
docker service update --env-add JUDGE_COMPILE_MEMORY_MB=768 --env-add JUDGE_COMPILE_CPUS=1 --env-add JUDGE_RUNTIME_CPUS=0.5 --env-add JUDGE_TMPFS_MB=128 codeclash-judge-yhgaa9_judge-worker
```

Include only the vars you are changing; anything omitted keeps its current
value. Wait for `verify: Service ... converged`, then go to **Verifying**.

Confirm what the service is actually running:

```bash
docker service inspect codeclash-judge-yhgaa9_judge-worker --format '{{range .Spec.TaskTemplate.ContainerSpec.Env}}{{println .}}{{end}}'
```

> `--env-add` writes to the live service spec and survives restarts. It does
> **not** survive a Dokploy stack redeploy, which reapplies the stack file. For
> a permanent change, also set it in the Dokploy service environment (defaults
> live in `docker/judge/docker-compose.yml`).

---

# Flow B — worker or runner code

Use when changing `judge.worker.ts`, docker runner code, Redis pub/sub, BullMQ
job handling, verdict processing, or worker-side services. Not for docs-only
changes.

### 1. Validate locally

```bash
cd /Users/pramitmanna/projects/codeclash/backend && git status && bun run build
```

Run the runner test suite too:

```bash
bun test docker/judge/runner/tests/
```

### 2. Build for the VPS architecture

Production is `linux/amd64`. On Apple Silicon the platform flag is required or
the image will not start.

```bash
cd /Users/pramitmanna/projects/codeclash/backend && docker buildx build --platform linux/amd64 -f docker/judge/worker.Dockerfile -t ghcr.io/pramit3129/codeclash-judge-worker:latest .
```

The trailing `.` sets the build context to `backend/` — `worker.Dockerfile`
copies from both `src/` and `docker/judge/runner/` to compile
`dist/judge-worker.js`.

### 3. Push to GHCR

```bash
docker login ghcr.io
```

```bash
docker push ghcr.io/pramit3129/codeclash-judge-worker:latest
```

### 4. Pull on the VPS

Never build on the VPS — always cross-compile locally and push.

```bash
ssh <vps>
```

```bash
docker pull ghcr.io/pramit3129/codeclash-judge-worker:latest
```

### 5. Rolling update

```bash
docker service update --image ghcr.io/pramit3129/codeclash-judge-worker:latest codeclash-judge-yhgaa9_judge-worker
```

Expect `verify: Service codeclash-judge-yhgaa9_judge-worker converged`. A
registry-access warning during digest resolution on `:latest` is safe to ignore
as long as convergence succeeds.

> `--image` swaps the image only — Swarm does not re-read the stack file. If the
> same commit also changed env values in `docker-compose.yml`, add them with
> `--env-add` in this command or they will not apply.

### 6. Confirm the new image is running

```bash
docker service ps codeclash-judge-yhgaa9_judge-worker
```

Newest task `Running`, previous task `Shutdown`.

```bash
docker ps --filter name=codeclash-judge-yhgaa9_judge-worker --format "table {{.Names}}\t{{.Image}}\t{{.Status}}"
```

---

# Verifying

After either flow.

### 1. Worker started

```bash
docker logs --tail 100 $(docker ps --filter name=codeclash-judge-yhgaa9_judge-worker --format "{{.Names}}")
```

Expect `Redis connected`, `Redis ready`, `judge worker ready`, and the
concurrency line.

### 2. Compilation works

Submit a C++ solution using `#include <bits/stdc++.h>`. Must return **Accepted**,
not Compilation Error.

### 3. Memory limits are enforced

The check that matters. If the sandbox is not narrowed after compiling, user
code runs with the compiler's headroom and MLE stops firing. Submit:

```cpp
#include <bits/stdc++.h>
using namespace std;
int main(){
  vector<char*> v;
  for(int i=0;i<400;i++){ char* p=(char*)malloc(1<<20); memset(p,1,1<<20); v.push_back(p); }
  cout<<"ok"<<endl; return 0;
}
```

Must return **MLE**. If it returns Accepted, roll back immediately.

> Do not test this with `docker inspect ... HostConfig.Memory` on a live
> sandbox. The container legitimately sits at the compile budget while g++ runs
> (~1s) and only drops to the problem's limit for execution (~350ms), so a
> single sample almost always catches the compile phase and looks like a
> failure. The 400 MB submission tests actual enforcement.

To watch a submission end to end:

```bash
docker logs -f $(docker ps --filter name=codeclash-judge-yhgaa9_judge-worker --format "{{.Names}}")
```

---

# Rollback

```bash
docker service rollback codeclash-judge-yhgaa9_judge-worker
```

Reverts image and environment together to the previous service spec. No data
migration is involved, so this is immediate and safe.

---

# The settings

| Variable                  | Default | Applies to                   |
| ------------------------- | ------- | ---------------------------- |
| `JUDGE_COMPILE_MEMORY_MB` | 768     | compile phase only           |
| `JUDGE_COMPILE_CPUS`      | 2       | compile phase only           |
| `JUDGE_RUNTIME_CPUS`      | 0.5     | user code                    |
| `JUDGE_TMPFS_MB`          | 128     | sandbox `/tmp`, build output |
| `JUDGE_CONCURRENCY`       | 1       | parallel judge jobs          |

All have defaults compiled into the image, so the service runs correctly with
none of them set.

### Sizing

```
worst-case judge RAM  =  JUDGE_COMPILE_MEMORY_MB x JUDGE_CONCURRENCY
```

Plus ~150 MB for the worker process. Check with `free -m` and read the
**available** column, not `free` — buff/cache is reclaimable.

Measured on `algoriumx-judge-cpp:1`, `g++ -std=c++20 -O2` on a
`#include <bits/stdc++.h>` program:

| Compile memory | Result                                           |
| -------------- | ------------------------------------------------ |
| 256 MB         | OOM-killed (`cc1plus` killed), at any tmpfs size |
| 320 MB         | compiles                                         |
| 768 MB         | compiles in ~1s (default)                        |

Do not go below 512 MB. That test program is trivial; template-heavy contest
code needs considerably more.

### Cautions

- **`JUDGE_COMPILE_CPUS` interacts with the 20s compile timeout.** At 768 MB and
  2 CPUs a `bits/stdc++.h` compile takes ~1s, so 1 CPU (~2s) is safe. Going much
  lower on heavy template code risks hitting `COMPILE_TIMEOUT_MS` and returning
  a spurious CE that looks like a compiler bug.
- **`JUDGE_RUNTIME_CPUS` changes verdicts.** It is what user code runs at.
  Raising it loosens every problem's effective time limit; lowering it causes
  spurious TLEs. Change only alongside re-tuning problem time limits.
- **`JUDGE_CONCURRENCY` needs CPU as well as RAM.** Each concurrent job takes
  `JUDGE_RUNTIME_CPUS` while executing. Oversubscribing inflates wall-clock time
  and causes spurious TLE verdicts, which is worse than a queue. Check `nproc`.

---

# Notes

- **In-flight jobs.** The rolling update stops the old task before starting the
  new one. BullMQ redelivers anything mid-judge, so submissions are delayed
  rather than lost.
- **Sandbox hardening is unaffected by any of these settings** —
  `--network none`, `--cap-drop ALL`, `--read-only`, `no-new-privileges`,
  `--pids-limit 100`. The compile budget is only ever held while the compiler
  runs on source text; user code never executes at it.
- **Leaked sandboxes.** If the worker is killed mid-judge, sandbox containers
  can survive on the host:
  `docker rm -f $(docker ps -aq --filter "label=com.algoriumx.judge")`
