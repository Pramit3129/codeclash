                 prisma/seed/problems.ts
                            │
                            ▼
                    ┌──────────────┐
                    │ Problem Spec │
                    │              │
                    │ starterCode  │───────► Frontend later
                    │ samples      │
                    │ hidden       │
                    │ solve()      │
                    └──────┬───────┘
                           │
                           ▼
                    prisma/seed.ts
                           │
             ┌─────────────┴──────────────┐
             │                            │
          samples                       hidden
             │                            │
       isSample=true                isSample=false
             │                            │
             └─────────────┬──────────────┘
                           ▼
                       solve(input)
                           │
                           ▼
                    expectedOutput
                           │
                           ▼
                      TestCase
                           │
                           ▼
                       PostgreSQL
                           │
             ┌─────────────┴─────────────┐
             │                           │
          Frontend                    Judge
             │                           │
      gets samples               gets hidden tests
      + starterCode              + expectedOutput