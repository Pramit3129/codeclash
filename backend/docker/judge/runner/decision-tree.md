                    RunResult
                       │
                       ▼
                  timedOut?
                  /       \
                YES        NO
                 │          │
                TLE     memoryExceeded?
                           /       \
                         YES        NO
                          │          │
                         MLE     exitCode != 0?
                                    /      \
                                  YES       NO
                                   │         │
                                  RE     compare output
                                             │
                                      ┌──────┴──────┐
                                    equal         unequal
                                      │               │
                                     AC              WA