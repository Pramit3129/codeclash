import {
    describe,
    expect,
    test,
    afterAll,
} from "bun:test";

import request from "supertest";

import { app } from "../src/app.js";
import { prisma } from "../src/lib/prisma.js";

// Returns the cookie header a browser would send next, given a response.
function cookiesFrom(response: request.Response): string[] {
    const setCookie = response.headers["set-cookie"];
    if (!setCookie) return [];
    return (setCookie as unknown as string[]).map(
        (cookie) => cookie.split(";")[0]!,
    );
}

async function login(): Promise<string[]> {
    const response = await request(app)
        .post("/api/auth/login")
        .send({
            email: process.env.TEST_EMAIL,
            password: process.env.TEST_PASSWORD,
        });

    expect(response.status).toBe(200);

    return cookiesFrom(response);
}

function refresh(cookies: string[]) {
    return request(app)
        .post("/api/auth/refresh")
        .set("Cookie", cookies);
}

describe("Refresh token rotation", () => {

    // ============================================================
    // Reloading the app repeatedly must not end the session.
    // ============================================================

    test("survives repeated reloads", async () => {
        let cookies = await login();

        for (let reload = 0; reload < 4; reload++) {
            const response = await refresh(cookies);

            expect(response.status).toBe(200);
            expect(response.body.accessToken).toBeString();

            const next = cookiesFrom(response);
            if (next.length > 0) cookies = next;
        }
    });


    // ============================================================
    // A duplicated bootstrap replays the token that was just
    // rotated away. Inside the grace window that is a race, not
    // theft, so the session must survive.
    // ============================================================

    test(
        "accepts the just-rotated token inside the grace window",
        async () => {
            const original = await login();

            const first = await refresh(original);
            expect(first.status).toBe(200);

            // Same cookie the racing tab still holds.
            const replay = await refresh(original);
            expect(replay.status).toBe(200);

            // The session must still be usable afterwards.
            const afterwards = await refresh(cookiesFrom(replay));
            expect(afterwards.status).toBe(200);
        },
    );


    // ============================================================
    // Two rotations racing from the same token must not leave the
    // stored hash disagreeing with the cookie the client kept.
    // ============================================================

    test(
        "leaves a usable session after concurrent rotation",
        async () => {
            const original = await login();

            const [a, b] = await Promise.all([
                refresh(original),
                refresh(original),
            ]);

            // Whichever Set-Cookie the browser ended up keeping has
            // to still work on the next reload.
            for (const response of [a, b]) {
                if (response.status !== 200) continue;

                const next = await refresh(cookiesFrom(response));
                expect(next.status).toBe(200);
            }
        },
    );


    // ============================================================
    // The security property itself: a token replayed long after
    // rotation is theft and must kill the session.
    // ============================================================

    test("revokes the session on reuse outside the grace window", async () => {
        const original = await login();

        const rotated = await refresh(original);
        expect(rotated.status).toBe(200);

        const sessionId = original[0]!.split("=")[1]!.split(".")[0]!;

        // Age the rotation past the grace window rather than sleeping
        // through it, so the suite stays fast.
        await prisma.session.update({
            where: { id: sessionId },
            data: { rotatedAt: new Date(Date.now() - 60_000) },
        });

        const stolen = await refresh(original);

        expect(stolen.status).toBe(401);
        expect(stolen.body.error.details.reason).toBe("reuse");

        // The whole session is now dead, including the good cookie.
        const dead = await refresh(cookiesFrom(rotated));
        expect(dead.status).toBe(401);
    });
});


afterAll(async () => {
    await prisma.$disconnect();
});
