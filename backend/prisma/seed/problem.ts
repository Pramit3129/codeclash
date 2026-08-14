import { Difficulty } from "@prisma/client";

export interface ProblemSpec {
    slug: string;
    title: string;
    statementMd: string;
    constraintsMd: string;
    difficulty: Difficulty;
    timeLimitMs: number;
    memoryLimitMb: number;
    starterCode: Record<string, string>;
    samples: string[];
    hidden: string[];
    solve(input: string): string;
}

export const specs: ProblemSpec[] = [

    // ============================================================
    // 1. SUM OF TWO NUMBERS
    // ============================================================
    {
        slug: "sum-of-two-numbers",

        title: "Sum of Two Numbers",

        statementMd: `
# Sum of Two Numbers

Given two integers, print their sum.

## Input

Two integers separated by a space.

## Output

Print the sum of the two integers.
`,

        constraintsMd: `
- The input contains exactly two integers \`a\` and \`b\` on a single line.
- -10^9 <= a <= 10^9
- -10^9 <= b <= 10^9
- The sum fits in a signed 64-bit integer.
`,

        difficulty: Difficulty.EASY,

        timeLimitMs: 1000,

        memoryLimitMb: 256,

        starterCode: {
            PYTHON: `import sys

def main():
    data = sys.stdin.read().split()

    a = int(data[0])
    b = int(data[1])

    # TODO: write your solution here


if __name__ == "__main__":
    main()
`,

            JAVASCRIPT: `const fs = require("fs");

function main() {
    const input = fs.readFileSync(0, "utf8").trim().split(/\\s+/);

    const a = Number(input[0]);
    const b = Number(input[1]);

    // TODO: write your solution here
}

main();
`,

            JAVA: `import java.io.*;
import java.util.*;

public class Main {
    public static void main(String[] args) throws Exception {
        BufferedReader br =
            new BufferedReader(new InputStreamReader(System.in));

        StringTokenizer st =
            new StringTokenizer(br.readLine());

        int a = Integer.parseInt(st.nextToken());
        int b = Integer.parseInt(st.nextToken());

        // TODO: write your solution here
    }
}
`,

            CPP: `#include <bits/stdc++.h>
using namespace std;

int main() {
    int a, b;

    cin >> a >> b;

    // TODO: write your solution here

    return 0;
}
`,
        },

        samples: [
            "2 3",
            "10 20",
        ],

        hidden: [
            "100 200",
            "-10 5",
            "999999 1",
        ],

        solve(input: string): string {
            const parts = input.trim().split(/\s+/).map(Number);

            const a = parts[0] ?? 0;
            const b = parts[1] ?? 0;

            return String(a + b);
        },
    },


    // ============================================================
    // 2. TWO SUM
    // ============================================================
    {
        slug: "two-sum",

        title: "Two Sum",

        statementMd: `
# Two Sum

Given an array of integers and a target value, find two different
indices whose values add up to the target.

You may assume that exactly one valid pair exists.

## Input

The first line contains an integer \`n\`.

The second line contains \`n\` space-separated integers.

The third line contains the target integer.

## Output

Print the two indices in increasing order.
`,

        constraintsMd: `
- 2 <= n <= 100000
- -10^9 <= nums[i] <= 10^9
- -10^9 <= target <= 10^9
- Indices are 0-based.
- The two indices must be different.
- Exactly one valid answer exists.
`,

        difficulty: Difficulty.EASY,

        timeLimitMs: 1000,

        memoryLimitMb: 256,

        starterCode: {
            PYTHON: `import sys

def main():
    data = sys.stdin.read().split()

    n = int(data[0])
    nums = list(map(int, data[1:n + 1]))
    target = int(data[n + 1])

    # TODO: find the two indices


if __name__ == "__main__":
    main()
`,

            JAVASCRIPT: `const fs = require("fs");

function main() {
    const data = fs.readFileSync(0, "utf8").trim().split(/\\s+/);

    const n = Number(data[0]);
    const nums = data.slice(1, n + 1).map(Number);
    const target = Number(data[n + 1]);

    // TODO: find the two indices
}

main();
`,

            JAVA: `import java.io.*;
import java.util.*;

public class Main {
    public static void main(String[] args) throws Exception {
        BufferedReader br =
            new BufferedReader(new InputStreamReader(System.in));

        int n = Integer.parseInt(br.readLine());

        int[] nums = new int[n];

        StringTokenizer st =
            new StringTokenizer(br.readLine());

        for (int i = 0; i < n; i++) {
            nums[i] = Integer.parseInt(st.nextToken());
        }

        int target = Integer.parseInt(br.readLine());

        // TODO: find the two indices
    }
}
`,

            CPP: `#include <bits/stdc++.h>
using namespace std;

int main() {
    int n;
    cin >> n;

    vector<int> nums(n);

    for (int i = 0; i < n; i++) {
        cin >> nums[i];
    }

    int target;
    cin >> target;

    // TODO: find the two indices

    return 0;
}
`,
        },

        samples: [
            `5
2 7 11 15 9
9`,

            `4
3 2 4 8
6`,
        ],

        hidden: [
            `3
3 3 5
6`,

            `6
1 8 4 12 3 7
10`,

            `5
-3 4 7 2 9
6`,
        ],

        solve(input: string): string {
            const data = input.trim().split(/\s+/).map(Number);

            const n = data[0]!;
            const nums = data.slice(1, n + 1);
            const target = data[n + 1]!;

            const map = new Map<number, number>();

            for (let i = 0; i < n; i++) {
                const complement = target - nums[i]!;

                if (map.has(complement)) {
                    const j = map.get(complement)!;

                    return `${j} ${i}`;
                }

                map.set(nums[i]!, i);
            }

            return "-1 -1";
        },
    },


    // ============================================================
    // 3. REVERSE ARRAY
    // ============================================================
    {
        slug: "reverse-array",

        title: "Reverse Array",

        statementMd: `
# Reverse Array

Given an array of integers, print the elements in reverse order.

## Input

The first line contains an integer \`n\`.

The second line contains \`n\` space-separated integers.

## Output

Print the reversed array.
`,

        constraintsMd: `
- 1 <= n <= 100000
- -10^9 <= arr[i] <= 10^9
- The second line contains exactly \`n\` integers.
- Output the \`n\` integers on a single line, separated by single spaces.
`,

        difficulty: Difficulty.MEDIUM,

        timeLimitMs: 1000,

        memoryLimitMb: 256,

        starterCode: {
            PYTHON: `import sys

def main():
    data = sys.stdin.read().split()

    n = int(data[0])
    arr = list(map(int, data[1:n + 1]))

    # TODO: reverse the array


if __name__ == "__main__":
    main()
`,

            JAVASCRIPT: `const fs = require("fs");

function main() {
    const data = fs.readFileSync(0, "utf8").trim().split(/\\s+/);

    const n = Number(data[0]);
    const arr = data.slice(1, n + 1).map(Number);

    // TODO: reverse the array
}

main();
`,

            JAVA: `import java.io.*;
import java.util.*;

public class Main {
    public static void main(String[] args) throws Exception {
        BufferedReader br =
            new BufferedReader(new InputStreamReader(System.in));

        int n = Integer.parseInt(br.readLine());

        int[] arr = new int[n];

        StringTokenizer st =
            new StringTokenizer(br.readLine());

        for (int i = 0; i < n; i++) {
            arr[i] = Integer.parseInt(st.nextToken());
        }

        // TODO: reverse the array
    }
}
`,

            CPP: `#include <bits/stdc++.h>
using namespace std;

int main() {
    int n;
    cin >> n;

    vector<int> arr(n);

    for (int i = 0; i < n; i++) {
        cin >> arr[i];
    }

    // TODO: reverse the array

    return 0;
}
`,
        },

        samples: [
            `5
1 2 3 4 5`,

            `4
10 20 30 40`,
        ],

        hidden: [
            `1
42`,

            `6
-1 0 5 -3 8 2`,

            `7
100 200 300 400 500 600 700`,
        ],

        solve(input: string): string {
            const data = input.trim().split(/\s+/).map(Number);

            const n = data[0]!;
            const arr = data.slice(1, n + 1);

            return arr.reverse().join(" ");
        },
    },


    // ============================================================
    // 4. MATRIX SUM
    // ============================================================
    {
        slug: "matrix-sum",

        title: "Matrix Sum",

        statementMd: `
# Matrix Sum

Given a matrix containing integers, calculate the sum of all
elements in the matrix.

## Input

The first line contains two integers \`r\` and \`c\`,
representing the number of rows and columns.

The next \`r\` lines each contain \`c\` integers.

## Output

Print the sum of all elements in the matrix.
`,

        constraintsMd: `
- 1 <= r <= 1000
- 1 <= c <= 1000
- r * c <= 100000
- -10^9 <= matrix[i][j] <= 10^9
- The total sum fits in a signed 64-bit integer.
`,

        difficulty: Difficulty.MEDIUM,

        timeLimitMs: 1000,

        memoryLimitMb: 256,

        starterCode: {
            PYTHON: `import sys

def main():
    data = sys.stdin.read().split()

    r = int(data[0])
    c = int(data[1])

    # TODO: read the matrix and calculate its sum


if __name__ == "__main__":
    main()
`,

            JAVASCRIPT: `const fs = require("fs");

function main() {
    const data = fs.readFileSync(0, "utf8").trim().split(/\\s+/);

    const r = Number(data[0]);
    const c = Number(data[1]);

    // TODO: read the matrix and calculate its sum
}

main();
`,

            JAVA: `import java.io.*;
import java.util.*;

public class Main {
    public static void main(String[] args) throws Exception {
        BufferedReader br =
            new BufferedReader(new InputStreamReader(System.in));

        StringTokenizer st =
            new StringTokenizer(br.readLine());

        int r = Integer.parseInt(st.nextToken());
        int c = Integer.parseInt(st.nextToken());

        int[][] matrix = new int[r][c];

        for (int i = 0; i < r; i++) {
            st = new StringTokenizer(br.readLine());

            for (int j = 0; j < c; j++) {
                matrix[i][j] = Integer.parseInt(st.nextToken());
            }
        }

        // TODO: calculate the matrix sum
    }
}
`,

            CPP: `#include <bits/stdc++.h>
using namespace std;

int main() {
    int r, c;
    cin >> r >> c;

    vector<vector<int>> matrix(r, vector<int>(c));

    for (int i = 0; i < r; i++) {
        for (int j = 0; j < c; j++) {
            cin >> matrix[i][j];
        }
    }

    // TODO: calculate the matrix sum

    return 0;
}
`,
        },

        samples: [
            `2 3
1 2 3
4 5 6`,

            `3 2
10 20
30 40
50 60`,
        ],

        hidden: [
            `1 1
42`,

            `2 2
-1 2
3 -4`,

            `3 3
1 2 3
4 5 6
7 8 9`,
        ],

        solve(input: string): string {
            const data = input.trim().split(/\s+/).map(Number);

            const r = data[0]!;
            const c = data[1]!;

            let sum = 0;
            let index = 2;

            for (let i = 0; i < r; i++) {
                for (let j = 0; j < c; j++) {
                    sum += data[index++]!;
                }
            }

            return String(sum);
        },
    },


    // ============================================================
    // 5. LONGEST PALINDROMIC SUBSTRING
    // ============================================================
    {
        slug: "longest-palindromic-substring",

        title: "Longest Palindromic Substring",

        statementMd: `
# Longest Palindromic Substring

Given a string, find the longest substring that is a palindrome.

If multiple palindromic substrings have the same maximum length,
print the one that occurs first.

## Input

The input contains a single string containing lowercase English
letters.

## Output

Print the longest palindromic substring.
`,

        constraintsMd: `
- 1 <= |s| <= 1000
- \`s\` consists only of lowercase English letters (\`a\`-\`z\`).
- \`s\` contains no spaces.
- If several palindromic substrings share the maximum length, print the one with the smallest starting index.
`,

        difficulty: Difficulty.HARD,

        timeLimitMs: 2000,

        memoryLimitMb: 256,

        starterCode: {
            PYTHON: `import sys

def main():
    s = sys.stdin.readline().strip()

    # TODO: find the longest palindromic substring


if __name__ == "__main__":
    main()
`,

            JAVASCRIPT: `const fs = require("fs");

function main() {
    const s = fs.readFileSync(0, "utf8").trim();

    // TODO: find the longest palindromic substring
}

main();
`,

            JAVA: `import java.io.*;
import java.util.*;

public class Main {
    public static void main(String[] args) throws Exception {
        BufferedReader br =
            new BufferedReader(new InputStreamReader(System.in));

        String s = br.readLine().trim();

        // TODO: find the longest palindromic substring
    }
}
`,

            CPP: `#include <bits/stdc++.h>
using namespace std;

int main() {
    string s;
    cin >> s;

    // TODO: find the longest palindromic substring

    return 0;
}
`,
        },

        samples: [
            `babad`,

            `cbbd`,
        ],

        hidden: [
            `racecar`,

            `forgeeksskeegfor`,

            `abacdfgdcaba`,
        ],

        solve(input: string): string {
            const s = input.trim();

            if (s.length <= 1) {
                return s;
            }

            let bestStart = 0;
            let bestLength = 1;

            function expand(left: number, right: number) {
                while (
                    left >= 0 &&
                    right < s.length &&
                    s[left] === s[right]
                ) {
                    const length = right - left + 1;

                    if (length > bestLength) {
                        bestStart = left;
                        bestLength = length;
                    }

                    left--;
                    right++;
                }
            }

            for (let i = 0; i < s.length; i++) {
                // Odd-length palindrome
                expand(i, i);

                // Even-length palindrome
                expand(i, i + 1);
            }

            return s.substring(
                bestStart,
                bestStart + bestLength
            );
        },
    },
];