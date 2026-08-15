import { PrismaClient } from "@prisma/client";

import { DockerRunner } from "../docker.runner.ts";
import { OutputComparator } from "../output.comparator.ts";
import { JudgeService } from "../judge.service.ts";
import { SubmissionService } from "../submission.service.ts";
import { SubmissionRepository } from "../submission.repository.ts";
import { ProblemRepository } from "../problem.repository.ts";

const prisma = new PrismaClient();
const runner = new DockerRunner();
const comparator = new OutputComparator();
const judgeService = new JudgeService(runner, comparator);
const submissionRepository = new SubmissionRepository(prisma);
const problemRepository = new ProblemRepository(prisma);

const submissionService = new SubmissionService(
  submissionRepository,
  problemRepository,
);


const user = await prisma.user.findFirst();
if (!user) throw new Error("No user exists in database");

const problem = await prisma.problem.findFirst({
  where: { slug: "sum-of-two-numbers" },
});
if (!problem) throw new Error("No problem exists in database");

console.log("=== 1. Testing Python ===");
const pySubmission = await submissionService.submit({
  userId: user.id,
  problemId: problem.id,
  language: "python",
  sourceCode: `
a, b = map(int, input().split())
print(a + b)
`,
});
console.log("Python verdict:", pySubmission.verdict);

console.log("=== 2. Testing JavaScript ===");
const jsSubmission = await submissionService.submit({
  userId: user.id,
  problemId: problem.id,
  language: "javascript",
  sourceCode: `
const fs = require('fs');
const input = fs.readFileSync(0, 'utf8').trim().split(/\\s+/);
if (input.length >= 2) {
  const a = Number(input[0]);
  const b = Number(input[1]);
  console.log(a + b);
}
`,
});
console.log("JavaScript verdict:", jsSubmission.verdict);

console.log("=== 3. Testing Java ===");
const javaSubmission = await submissionService.submit({
  userId: user.id,
  problemId: problem.id,
  language: "java",
  sourceCode: `
import java.util.Scanner;

public class Main {
    public static void main(String[] args) {
        Scanner sc = new Scanner(System.in);
        if (sc.hasNextInt()) {
            int a = sc.nextInt();
            int b = sc.nextInt();
            System.out.println(a + b);
        }
    }
}
`,
});
console.log("Java verdict:", javaSubmission.verdict);

console.log("=== 4. Testing C++ ===");
const cppSubmission = await submissionService.submit({
  userId: user.id,
  problemId: problem.id,
  language: "cpp",
  sourceCode: `
#include <iostream>
using namespace std;

int main() {
    long long a, b;
    if (cin >> a >> b) {
        cout << (a + b) << endl;
    }
    return 0;
}
`,
});
console.log("C++ verdict:", cppSubmission.verdict);

console.log("=== 5. Testing Compilation Error (CE) ===");
const ceSubmission = await submissionService.submit({
  userId: user.id,
  problemId: problem.id,
  language: "cpp",
  sourceCode: `
#include <iostream>
int main() {
    this_is_syntax_error;
}
`,
});
console.log("CE verdict:", ceSubmission.verdict);

await prisma.$disconnect();
