# Judge tests

## `*.test.ts` — automated

Run with `bun test`. These need a working Docker daemon and the four
judge images built (`algoriumx-judge-{python,javascript,java,cpp}:1`).
They never touch PostgreSQL, so they are safe to run anywhere.

| File | Covers |
| --- | --- |
| `sandbox-security.test.ts` | Sandbox escape, worker-hang and resource-limit attacks |
| `judge-verdicts.test.ts` | AC / WA / RE / CE / TLE / MLE / OLE across all four languages |
| `concurrency.test.ts` | Parallel submissions, isolation, container cleanup |

## `*.manual.ts` — manual scripts, NOT automated tests

These are top-level scripts that execute on import and **write to the
database configured in `DATABASE_URL`**. They were previously named
`*.test.ts`, which meant `bun test` would pick them up and create real
submissions in whatever database was configured — production included.

Run them deliberately and only against a throwaway database:

```bash
bun run docker/judge/runner/tests/multi-language.manual.ts
```
