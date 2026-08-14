import {
    describe,
    expect,
    test,
    afterAll,
} from "bun:test";

import request from "supertest";

import { app } from "../src/app.js";
import { prisma } from "../src/lib/prisma.js";
import { specs } from "../prisma/seed/problem.js";

// Logs in with the test credentials and returns a request builder for `path`
// carrying whichever auth mechanism login handed back (bearer token, cookies,
// or both).
async function authedGet(path: string) {
    const loginResponse = await request(app)
        .post("/api/auth/login")
        .send({
            email: process.env.TEST_EMAIL,
            password: process.env.TEST_PASSWORD,
        });

    expect(loginResponse.status).toBe(200);

    const token =
        loginResponse.body.token ??
        loginResponse.body.accessToken;

    let problemRequest = request(app).get(path);

    if (token) {
        problemRequest =
            problemRequest.set(
                "Authorization",
                `Bearer ${token}`
            );
    }

    const cookies =
        loginResponse.headers["set-cookie"];

    if (cookies && cookies.length > 0) {
        problemRequest =
            problemRequest.set(
                "Cookie",
                cookies
            );
    }

    return problemRequest;
}

describe("Problem API", () => {

    test("does not leak hidden test cases", async () => {

        // ========================================================
        // 1. Login
        // ========================================================

        const loginResponse = await request(app)
            .post("/api/auth/login")
            .send({
                email: process.env.TEST_EMAIL,
                password: process.env.TEST_PASSWORD,
            });

        console.log(
            "LOGIN STATUS:",
            loginResponse.status
        );

        console.log(
            "LOGIN RESPONSE:",
            loginResponse.body
        );

        console.log(
            "LOGIN SET-COOKIE:",
            loginResponse.headers["set-cookie"]
        );

        expect(loginResponse.status).toBe(200);


        // ========================================================
        // 2. Get access token
        // ========================================================

        const token =
            loginResponse.body.token ??
            loginResponse.body.accessToken;

        console.log("ACCESS TOKEN:", token);


        // ========================================================
        // 3. Call protected problem endpoint
        // ========================================================

        let problemRequest =
            request(app)
                .get("/api/problems/sum-of-two-numbers");


        // If login returned an access token in the response body,
        // send it as a Bearer token.
        if (token) {
            problemRequest =
                problemRequest.set(
                    "Authorization",
                    `Bearer ${token}`
                );
        }

        // If authentication uses cookies, forward the cookies
        // returned by the login request.
        const cookies =
            loginResponse.headers["set-cookie"];

        if (cookies && cookies.length > 0) {
            problemRequest =
                problemRequest.set(
                    "Cookie",
                    cookies
                );
        }


        const response =
            await problemRequest;


        // ========================================================
        // 4. API should succeed
        // ========================================================

        console.log(
            "PROBLEM STATUS:",
            response.status
        );

        console.log(
            "PROBLEM RESPONSE:",
            response.body
        );

        expect(response.status).toBe(200);


        // ========================================================
        // 5. Find a hidden test directly in DB
        // ========================================================

        const hiddenTest =
            await prisma.testCase.findFirst({
                where: {
                    problem: {
                        slug: "sum-of-two-numbers",
                    },
                    isSample: false,
                },
            });


        // There must actually be a hidden test
        expect(hiddenTest).not.toBeNull();


        // ========================================================
        // 6. Convert API response to string
        // ========================================================

        const responseBody =
            JSON.stringify(response.body);


        // ========================================================
        // 7. Hidden INPUT must not appear in API response
        // ========================================================

        expect(responseBody)
            .not.toContain(hiddenTest!.input);


        // ========================================================
        // 8. Hidden OUTPUT must not appear in API response
        // ========================================================

        expect(responseBody)
            .not.toContain(
                hiddenTest!.expectedOutput
            );
    });


    // ============================================================
    // CACHE CONTROL — DETAIL
    // ============================================================

    test(
        "sets cache-control on problem details",
        async () => {

            const loginResponse =
                await request(app)
                    .post("/api/auth/login")
                    .send({
                        email: process.env.TEST_EMAIL,
                        password: process.env.TEST_PASSWORD,
                    });

            expect(loginResponse.status).toBe(200);

            const token =
                loginResponse.body.token ??
                loginResponse.body.accessToken;

            let problemRequest =
                request(app)
                    .get(
                        "/api/problems/sum-of-two-numbers"
                    );

            if (token) {
                problemRequest =
                    problemRequest.set(
                        "Authorization",
                        `Bearer ${token}`
                    );
            }

            const cookies =
                loginResponse.headers["set-cookie"];

            if (cookies && cookies.length > 0) {
                problemRequest =
                    problemRequest.set(
                        "Cookie",
                        cookies
                    );
            }

            const response =
                await problemRequest;

            expect(response.status).toBe(200);

            expect(
                response.headers["cache-control"]
            ).toBe("public, max-age=60");
        }
    );


    // ============================================================
    // CACHE CONTROL — LIST
    // ============================================================

    test(
        "sets cache-control on problem list",
        async () => {

            const loginResponse =
                await request(app)
                    .post("/api/auth/login")
                    .send({
                        email: process.env.TEST_EMAIL,
                        password: process.env.TEST_PASSWORD,
                    });

            expect(loginResponse.status).toBe(200);

            const token =
                loginResponse.body.token ??
                loginResponse.body.accessToken;

            let problemRequest =
                request(app)
                    .get("/api/problems");

            if (token) {
                problemRequest =
                    problemRequest.set(
                        "Authorization",
                        `Bearer ${token}`
                    );
            }

            const cookies =
                loginResponse.headers["set-cookie"];

            if (cookies && cookies.length > 0) {
                problemRequest =
                    problemRequest.set(
                        "Cookie",
                        cookies
                    );
            }

            const response =
                await problemRequest;

            expect(response.status).toBe(200);

            expect(
                response.headers["cache-control"]
            ).toBe("public, max-age=60");
        }
    );


    // ============================================================
    // CONSTRAINTS — DETAIL
    // ============================================================

    test(
        "returns constraints, starter code and only sample tests",
        async () => {

            const slug = "sum-of-two-numbers";

            const spec = specs.find(
                (candidate) => candidate.slug === slug
            );

            expect(spec).toBeDefined();


            // 1. Endpoint responds 200
            const response =
                await authedGet(`/api/problems/${slug}`);

            expect(response.status).toBe(200);

            const problemDetails =
                response.body.problemDetails;


            // 2. constraintsMd exists
            expect(problemDetails.constraintsMd)
                .toBeDefined();

            expect(typeof problemDetails.constraintsMd)
                .toBe("string");

            expect(
                problemDetails.constraintsMd.trim().length
            ).toBeGreaterThan(0);


            // 3. constraintsMd holds the seeded value
            expect(problemDetails.constraintsMd)
                .toBe(spec!.constraintsMd);

            expect(problemDetails.constraintsMd)
                .toContain("-10^9 <= a <= 10^9");

            // Constraints stay separate from the statement
            expect(problemDetails.statementMd)
                .not.toContain("-10^9 <= a <= 10^9");


            // 4. starterCode still exists
            expect(problemDetails.starterCode)
                .toBeDefined();

            for (const language of [
                "PYTHON",
                "JAVASCRIPT",
                "JAVA",
                "CPP",
            ]) {
                expect(
                    typeof problemDetails
                        .starterCode[language]
                ).toBe("string");
            }


            // 5. Sample test cases are returned
            const sampleTests =
                await prisma.testCase.findMany({
                    where: {
                        problem: { slug },
                        isSample: true,
                    },
                    orderBy: { ordinal: "asc" },
                });

            expect(sampleTests.length)
                .toBe(spec!.samples.length);

            expect(problemDetails.testCases.length)
                .toBe(sampleTests.length);

            for (const sample of sampleTests) {
                expect(
                    problemDetails.testCases.some(
                        (testCase: {
                            input: string;
                            expectedOutput: string;
                        }) =>
                            testCase.input === sample.input &&
                            testCase.expectedOutput ===
                                sample.expectedOutput
                    )
                ).toBe(true);
            }


            // 6. Hidden test cases are NOT returned
            const hiddenTests =
                await prisma.testCase.findMany({
                    where: {
                        problem: { slug },
                        isSample: false,
                    },
                });

            expect(hiddenTests.length)
                .toBe(spec!.hidden.length);

            // Serialized without the generated cuid so short
            // numeric outputs can't coincidentally match it.
            const responseBody =
                JSON.stringify({
                    ...problemDetails,
                    id: undefined,
                });

            for (const hidden of hiddenTests) {
                // Not present as a returned test case ...
                expect(
                    problemDetails.testCases.some(
                        (testCase: { input: string }) =>
                            testCase.input === hidden.input
                    )
                ).toBe(false);

                // ... and not leaked anywhere else in the payload.
                expect(responseBody)
                    .not.toContain(hidden.input.trimEnd());

                expect(responseBody)
                    .not.toContain(
                        hidden.expectedOutput.trimEnd()
                    );
            }
        }
    );
});


afterAll(async () => {
    await prisma.$disconnect();
});