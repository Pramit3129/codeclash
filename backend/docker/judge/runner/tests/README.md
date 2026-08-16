# Judge tests

## `*.test.ts` — automated

Run with `bun test`. These need a working Docker daemon and the four
judge images built (`algoriumx-judge-{python,javascript,java,cpp}:1`).
They never touch PostgreSQL, so they are safe to run anywhere.

| File | Covers | Needs |
| --- | --- | --- |
| `output-comparator.test.ts` | `normalize()` / `compare()` whitespace, CRLF, trailing newlines | nothing |
| `classify-execution.test.ts` | `classifyExecution()` verdict mapping and precedence | nothing |
| `judge-concurrency.test.ts` | `resolveConcurrency()` env parsing | nothing |
| `sandbox-security.test.ts` | Sandbox escape, worker-hang and resource-limit attacks | Docker |
| `judge-verdicts.test.ts` | AC / WA / RE / CE / TLE / MLE / OLE across all four languages, plus the Python reference-solution regression | Docker |
| `concurrency.test.ts` | Parallel submissions, isolation, container cleanup | Docker |
| `idempotency.test.ts` | Job replay creates no duplicate result rows | PostgreSQL (opt-in) |

### `idempotency.test.ts` — opt-in database test

Skipped unless `JUDGE_TEST_DATABASE_URL` is set. It never falls back to
`DATABASE_URL`, and refuses to start against a URL that looks like a
managed host (neon/rds/supabase/railway/render/planetscale), so it
cannot touch production.

```bash
docker run -d --name judge-test-db \
  -e POSTGRES_USER=judge -e POSTGRES_PASSWORD=judge -e POSTGRES_DB=judge \
  -p 55433:5432 postgres:16-alpine

export JUDGE_TEST_DATABASE_URL=postgresql://judge:judge@localhost:55433/judge
DATABASE_URL=$JUDGE_TEST_DATABASE_URL bunx prisma migrate deploy
bun test ./docker/judge/runner/tests/idempotency.test.ts
```

## `*.manual.ts` — manual scripts, NOT automated tests

These are top-level scripts that execute on import and **write to the
database configured in `DATABASE_URL`**. They were previously named
`*.test.ts`, which meant `bun test` would pick them up and create real
submissions in whatever database was configured — production included.

Run them deliberately and only against a throwaway database:

```bash
bun run docker/judge/runner/tests/multi-language.manual.ts
```
