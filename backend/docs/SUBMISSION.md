# CodeClash Asynchronous Submissions & Judging System

This document outlines the architecture, API endpoints, language configurations, verdict definitions, and verified test results for the CodeClash online judge execution engine.

---

## 1. System Architecture

The submission pipeline is built for high throughput, security, and multi-language execution using an asynchronous message-driven architecture:

```text
 Client (cURL / Frontend)
           │
           │  1. POST /api/submissions
           ▼
┌──────────────────────┐
│     Express API      │ ── 2. Create Submission (verdict: null) ──► [ PostgreSQL ]
└──────────────────────┘
           │
           │  3. Publish "judge-submission" job
           ▼
     [ BullMQ / Redis ]
           │
           │  4. Dequeue Job
           ▼
┌──────────────────────┐
│     Judge Worker     │ ── 5. Run Isolated Sandbox ──► [ Docker Container ]
└──────────────────────┘                                  (Python / JS / Java / C++)
           │
           │  6. Store Verdict & Test Results
           ▼
     [ PostgreSQL ]
```

---

## 2. API Endpoints

### 1. Create Submission

**`POST /api/submissions`**  
Requires authentication (`Bearer <TOKEN>`). Accepts code submissions, creates an initial queued database record (`verdict: null`), and enqueues a job to BullMQ.

#### Request Body
```json
{
  "problemId": "cmsshl7le0000qgbxrapvgtz7",
  "language": "python",
  "sourceCode": "a, b = map(int, input().split())\nprint(a + b)"
}
```

Supported `language` values: `"python"`, `"javascript"`, `"js"`, `"java"`, `"cpp"`, `"c++"`.

#### Response (`HTTP 202 Accepted`)
```json
{
  "success": true,
  "submission": {
    "id": "cmsu2wq2o0001qt0vmdpacili",
    "verdict": null,
    "totalTestCases": 5,
    "passedTestCases": 0,
    "createdAt": "2026-08-15T07:53:06.817Z"
  }
}
```

---

### 2. Get Submission Details & Results

**`GET /api/submissions/:id`**  
Requires authentication (`Bearer <TOKEN>`). Users may inspect their own submission status and per-test-case execution results.

#### Response (`HTTP 200 OK`)
```json
{
  "success": true,
  "submission": {
    "id": "cmsu2wq2o0001qt0vmdpacili",
    "userId": "cmsdehm930004lv01ilhidafx",
    "problemId": "cmsshl7le0000qgbxrapvgtz7",
    "language": "PYTHON",
    "sourceCode": "a, b = map(int, input().split())\nprint(a + b)",
    "verdict": "AC",
    "passedTestCases": 5,
    "totalTestCases": 5,
    "failedTestCaseId": null,
    "executionTimeMs": 464.57,
    "createdAt": "2026-08-15T07:53:06.817Z",
    "testResults": [
      {
        "id": "cmsu2wriy0001qgpt20z27k5s",
        "submissionId": "cmsu2wq2o0001qt0vmdpacili",
        "testCaseId": "cmsslsg3d0006qg82xcoepc8k",
        "verdict": "AC",
        "stdout": "5\n",
        "stderr": "",
        "exitCode": 0,
        "executionTimeMs": 77.63
      }
    ]
  }
}
```

---

## 3. Supported Languages & Docker Containers

Each supported language runs inside a custom, read-only Docker sandbox image equipped with strict CPU, memory, and process limits (`--pids-limit 100`, `--read-only`, `--tmpfs /tmp:exec`).

| Language | Identifier | Docker Sandbox Image | Preparation Command | Execution Command |
| :--- | :--- | :--- | :--- | :--- |
| **Python 3** | `python` | `algoriumx-judge-python:1` | *None* | `python3 /sandbox/main.py` |
| **Node.js** | `javascript`, `js` | `algoriumx-judge-javascript:1` | *None* | `node /sandbox/main.js` |
| **Java 21** | `java` | `algoriumx-judge-java:1` | `javac main.java -d /tmp` | `java -cp /tmp Main` |
| **C++ 14** | `cpp`, `c++` | `algoriumx-judge-cpp:1` | `g++ -O3 /sandbox/main.cpp -o /tmp/main` | `/tmp/main` |

---

## 4. Verdict Definitions

| Verdict | Meaning | Description |
| :--- | :--- | :--- |
| **`AC`** | Accepted | Code executed cleanly and output matched expected output across all test cases. |
| **`WA`** | Wrong Answer | Code completed but output did not match expected output for a test case. |
| **`CE`** | Compilation Error | Code failed to compile during `prepareSandbox` (Java/C++). |
| **`RE`** | Runtime Error | Code threw an unhandled exception, syntax error, or exited with non-zero exit code. |
| **`TLE`** | Time Limit Exceeded | Code execution exceeded `problem.timeLimitMs`. |
| **`MLE`** | Memory Limit Exceeded | Code memory consumption exceeded `problem.memoryLimitMb`. |
| **`OLE`** | Output Limit Exceeded | Code output stream exceeded maximum permitted bytes (`1 MB`). |

---

## 5. Multi-Language Test Verification Matrix

All six verdict mechanisms (`AC`, `WA`, `OLE`, `MLE`, `TLE`, `RE`, `CE`) have been fully verified end-to-end through the HTTP API and worker pipeline:

### 1. Accepted (`AC`) Test Results

| Language | Test Code | HTTP Status | Judged Verdict | Passed / Total | Total Time |
| :--- | :--- | :--- | :--- | :--- | :--- |
| **Python** | `a, b = map(int, input().split()); print(a + b)` | `202 Accepted` | **`AC`** | `5 / 5` | `464.57 ms` |
| **JavaScript** | `const fs = require("fs"); ... console.log(a + b);` | `202 Accepted` | **`AC`** | `5 / 5` | `674.14 ms` |
| **Java** | `Scanner sc = new Scanner(System.in); ... System.out.println(a + b);` | `202 Accepted` | **`AC`** | `5 / 5` | `1635.26 ms` |
| **C++** | `cin >> a >> b; cout << a + b << endl;` | `202 Accepted` | **`AC`** | `5 / 5` | `803.06 ms` |

---

### 2. Wrong Answer (`WA`) Test Results

| Language | Test Code (`a - b` output) | HTTP Status | Judged Verdict | Passed / Total | `failedTestCaseId` | Output |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| **Python** | `print(a - b)` | `202 Accepted` | **`WA`** | `0 / 5` | `cmsslsg3d0006qg82xcoepc8k` | `"-1\n"` |
| **JavaScript** | `console.log(a - b)` | `202 Accepted` | **`WA`** | `0 / 5` | `cmsslsg3d0006qg82xcoepc8k` | `"-1\n"` |
| **Java** | `System.out.println(a - b)` | `202 Accepted` | **`WA`** | `0 / 5` | `cmsslsg3d0006qg82xcoepc8k` | `"-1\n"` |
| **C++** | `cout << a - b << endl` | `202 Accepted` | **`WA`** | `0 / 5` | `cmsslsg3d0006qg82xcoepc8k` | `"-1\n"` |

---

### 3. Output Limit Exceeded (`OLE`) Test Results

| Language | Code / Excessive Print Loop | HTTP Status | Judged Verdict | Passed / Total | `failedTestCaseId` | Threshold | Worker Status |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| **Python** | `while True: print("A" * 100000)` | `202 Accepted` | **`OLE`** | `0 / 5` | `cmsslsg3d0006qg82xcoepc8k` | `> 1 MB` Output | **Healthy & Alive** |

---

### 4. Memory Limit Exceeded (`MLE`) Test Results

| Language | Allocation Code | HTTP Status | Judged Verdict | Passed / Total | `failedTestCaseId` | Exit Code | Docker OOM Killer Signal | Worker Status |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| **Python** | `chunks.append("A" * 10MB)` | `202 Accepted` | **`MLE`** | `0 / 5` | `cmsslsg3d0006qg82xcoepc8k` | `137` | `State.OOMKilled = true` (SIGKILL 9) | **Healthy & Alive** |

---

### 5. Time Limit Exceeded (`TLE`) Test Results

| Language | Infinite Loop Code | HTTP Status | Judged Verdict | Passed / Total | `failedTestCaseId` | Timeout Execution Time | Worker Status |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| **Python** | `while True: pass` | `202 Accepted` | **`TLE`** | `0 / 5` | `cmsslsg3d0006qg82xcoepc8k` | `1035.58 ms` | **Healthy & Alive** |
| **JavaScript** | `while (true) {}` | `202 Accepted` | **`TLE`** | `0 / 5` | `cmsslsg3d0006qg82xcoepc8k` | `1032.60 ms` | **Healthy & Alive** |
| **Java** | `while (true) {}` | `202 Accepted` | **`TLE`** | `0 / 5` | `cmsslsg3d0006qg82xcoepc8k` | `1035.29 ms` | **Healthy & Alive** |
| **C++** | `while (true) {}` | `202 Accepted` | **`TLE`** | `0 / 5` | `cmsslsg3d0006qg82xcoepc8k` | `1062.26 ms` | **Healthy & Alive** |

---

### 6. Runtime Error (`RE`) Test Results

| Language | Code / Runtime Crash Scenario | HTTP Status | Judged Verdict | Passed / Total | `failedTestCaseId` | Exit Code | Captured `stderr` |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| **Python** | `raise RuntimeError("runtime error test")` | `202 Accepted` | **`RE`** | `0 / 5` | `cmsslsg3d0006qg82xcoepc8k` | `1` | `RuntimeError: runtime error test` |
| **JavaScript** | `throw new Error("runtime error test");` | `202 Accepted` | **`RE`** | `0 / 5` | `cmsslsg3d0006qg82xcoepc8k` | `1` | `Error: runtime error test` |
| **Java** | `throw new RuntimeException("runtime error test");` | `202 Accepted` | **`RE`** | `0 / 5` | `cmsslsg3d0006qg82xcoepc8k` | `1` | `java.lang.RuntimeException: runtime error test` |
| **C++** | `int* p = nullptr; cout << *p;` (Segmentation Fault) | `202 Accepted` | **`RE`** | `0 / 5` | `cmsslsg3d0006qg82xcoepc8k` | `139` | *(Signal 11 SIGSEGV crash caught)* |

---

### 7. Compilation Error (`CE`) Test Results

| Language | Code / Syntax Error Scenario | HTTP Status | Judged Verdict | Passed / Total | Preparation Behavior |
| :--- | :--- | :--- | :--- | :--- | :--- |
| **Java** | Syntax Error (`int a = ;`) | `202 Accepted` | **`CE`** | `0 / 5` | `javac` compilation failure caught in `prepareSandbox` |
| **C++** | Syntax Error (`int a = ;`) | `202 Accepted` | **`CE`** | `0 / 5` | `g++` compilation failure caught in `prepareSandbox` |
