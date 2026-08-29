# Judge worker — redeploy

Two different flows. Pick by what actually changed.

| What changed                                   | Flow  | Rebuild + push? |
| ---------------------------------------------- | ----- | --------------- |
| Only limits / env vars (`JUDGE_*`)             | **A** | No              |
| Worker or runner code (`.ts` files)            | **B** | Yes             |

Neither involves a database migration. Rollback is a Swarm rollback.

Service name: `codeclash-judge-yhgaa9_judge-worker`

---

## Flow A — changing limits only

Nothing to build. The image is unchanged; only the service's environment is.
Run this on the VPS:

```bash
docker service update --env-add JUDGE_COMPILE_MEMORY_MB=768 --env-add JUDGE_COMPILE_CPUS=1 --env-add JUDGE_RUNTIME_CPUS=0.5 --env-add JUDGE_TMPFS_MB=128 codeclash-judge-yhgaa9_judge-worker
```

Include only the vars you are actually changing — anything omitted keeps its
current value. Wait for `verify: Service ... converged`, then jump to
**Verifying** below.

> `--env-add` writes to the live service spec, so it survives restarts. It does
> **not** survive a Dokploy stack redeploy, which reapplies the stack file. To
> make a limit permanent, also set it in the Dokploy service environment (or in
> `docker/judge/docker-compose.yml`, which is where the defaults live).

To confirm what the service is actually running:

```bash
docker service inspect codeclash-judge-yhgaa9_judge-worker --format '{{range .Spec.TaskTemplate.ContainerSpec.Env}}{{println .}}{{end}}'
```

---

## Flow B — changing worker code

Follow the standard worker runbook: validate locally, `docker buildx build
--platform linux/amd64`, push to GHCR, pull on the VPS, then:

```bash
docker service update --image ghcr.io/pramit3129/codeclash-judge-worker:latest codeclash-judge-yhgaa9_judge-worker
```

`--image` swaps the image only. Swarm does not re-read the stack file, so any
env changes made in `docker-compose.yml` in the same commit will **not** apply
— add them with `--env-add` in the same command, or redeploy the stack.

---

## The settings

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

Plus ~150 MB for the worker process. Check headroom with `free -m` and read the
**available** column, not `free` — buff/cache is reclaimable.

Measured on `algoriumx-judge-cpp:1`, `g++ -std=c++20 -O2` on a
`#include <bits/stdc++.h>` program:

| Compile memory | Result                                         |
| -------------- | ---------------------------------------------- |
| 256 MB         | OOM-killed (`cc1plus` killed), at any tmpfs size |
| 320 MB         | compiles                                       |
| 768 MB         | compiles in ~1s (default)                      |

Do not go below 512 MB. That test program is trivial; template-heavy contest
code needs considerably more.

### Cautions

- **`JUDGE_COMPILE_CPUS` interacts with the 20s compile timeout.** At 768 MB and
  2 CPUs a `bits/stdc++.h` compile takes ~1s, so 1 CPU (~2s) is safe. Going much
  lower on heavy template code risks hitting `COMPILE_TIMEOUT_MS` and returning
  a spurious CE.
- **`JUDGE_RUNTIME_CPUS` changes verdicts.** It is what user code runs at.
  Raising it loosens every problem's effective time limit; lowering it causes
  spurious TLEs. Change only alongside re-tuning problem time limits.
- **`JUDGE_CONCURRENCY` needs CPU as well as RAM.** Each concurrent job takes
  `JUDGE_RUNTIME_CPUS` while executing. Oversubscribing inflates wall-clock time
  and causes spurious TLE verdicts, which is worse than a queue. Check `nproc`.

---

## Verifying

After either flow.

**1. Worker came up.**

```bash
docker logs --tail 50 $(docker ps --filter name=codeclash-judge-yhgaa9_judge-worker --format "{{.Names}}")
```

Expect `Redis connected` and `judge worker ready`.

**2. Compilation works.** Submit a C++ solution using `#include <bits/stdc++.h>`.
Must return Accepted, not Compilation Error.

**3. Memory limits are enforced.** This is the check that matters — if the
sandbox is not narrowed after compiling, user code runs with the compiler's
headroom and MLE stops firing. Submit:

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

---

## Rollback

```bash
docker service rollback codeclash-judge-yhgaa9_judge-worker
```

Reverts to the previous service spec — image and environment both. No data
migration is involved, so this is immediate and safe.

---

## Notes

- **In-flight jobs.** The rolling update stops the old task before starting the
  new one. BullMQ redelivers anything mid-judge, so submissions are delayed
  rather than lost.
- **Sandbox hardening is unchanged by any of these settings** —
  `--network none`, `--cap-drop ALL`, `--read-only`, `no-new-privileges`,
  `--pids-limit 100`. The compile budget is only ever held while the compiler
  runs on source text; user code never executes at it.
- **Leaked sandboxes.** If the worker is killed mid-judge, sandbox containers
  can survive on the host:
  `docker rm -f $(docker ps -aq --filter "label=com.algoriumx.judge")`
