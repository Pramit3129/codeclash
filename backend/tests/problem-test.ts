import {
    describe,
    expect,
    test,
    afterAll,
} from "bun:test";

import request from "supertest";

import { app } from "../src/app.js";
import { prisma } from "../src/lib/prisma.js";

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
});


afterAll(async () => {
    await prisma.$disconnect();
});