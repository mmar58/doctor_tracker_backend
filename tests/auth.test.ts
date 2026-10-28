/**
 * Auth route integration tests
 * Covers: register, login, /me, logout, and role-protection rules.
 */
import { describe, it, expect, beforeAll, afterAll, afterEach } from "vitest";
import request from "supertest";
import mongoose from "mongoose";
import { createApp } from "../src/app.js";
import { UserModel } from "../src/db/schema/index.js";
import { env } from "../src/config/env.js";
import { HEADERS, type AppType, loginAs } from "./helper.js";


let app: AppType;

beforeAll(async () => {
    // global-setup connects in the setup worker; test workers need their own connection.
    if (mongoose.connection.readyState === 0) {
        await mongoose.connect(process.env.MONGODB_URI!);
    }
    app = createApp();
});

afterAll(async () => {
    await mongoose.disconnect();
});

// Helper: perform login and return the supertest response


// ── Registration ─────────────────────────────────────────────────────────────
describe("POST /api/auth/register", () => {
    const validPayload = {
        name: "Test Doctor",
        email: "doctor@test.com",
        password: "securePassword1",
    };

    afterEach(async () => {
        // Clean up registered test users (keep the seeded admin)
        await UserModel.deleteMany({ email: { $ne: env.SEED_ADMIN_EMAIL } });
    });

    it("registers a new user and returns 201 with user data", async () => {
        const res = await request(app)
            .post("/api/auth/register")
            .set(HEADERS)
            .send(validPayload);

        expect(res.status).toBe(201);
        expect(res.body).toMatchObject({
            email: validPayload.email,
            name: validPayload.name,
            role: "doctor",           // always doctor, never admin
        });
        // Password hash must never be exposed
        expect(res.body.passwordHash).toBeUndefined();
    });

    it("sets a session cookie on successful registration", async () => {
        const res = await request(app)
            .post("/api/auth/register")
            .set(HEADERS)
            .send(validPayload);

        expect(res.status).toBe(201);
        expect(res.headers["set-cookie"]).toBeDefined();
    });

    it("returns 409 when email is already taken", async () => {
        // Register once
        await request(app).post("/api/auth/register").set(HEADERS).send(validPayload);
        // Try again
        const res = await request(app)
            .post("/api/auth/register")
            .set(HEADERS)
            .send(validPayload);

        expect(res.status).toBe(409);
    });

    it("returns 400 for invalid email format", async () => {
        const res = await request(app)
            .post("/api/auth/register")
            .set(HEADERS)
            .send({ ...validPayload, email: "not-an-email" });

        expect(res.status).toBe(400);
    });

    it("returns 400 when password is too short", async () => {
        const res = await request(app)
            .post("/api/auth/register")
            .set(HEADERS)
            .send({ ...validPayload, password: "short" });

        expect(res.status).toBe(400);
    });

    // ── Admin-role protection ──────────────────────────────────────────────
    it("returns 400 when body contains role=admin", async () => {
        const res = await request(app)
            .post("/api/auth/register")
            .set(HEADERS)
            .send({ ...validPayload, role: "admin" });

        expect(res.status).toBe(400);
        expect(res.body.error).toMatch(/admin/i);
    });

    it("ignores a role=doctor payload and still assigns doctor role", async () => {
        // role: "doctor" is harmless — should succeed
        const res = await request(app)
            .post("/api/auth/register")
            .set(HEADERS)
            .send({ ...validPayload, role: "doctor" });

        expect(res.status).toBe(201);
        expect(res.body.role).toBe("doctor");
    });

    it("does not expose a way to create an admin through registration", async () => {
        const res = await request(app)
            .post("/api/auth/register")
            .set(HEADERS)
            .send({ ...validPayload, role: "admin" });

        expect(res.status).toBe(400);
    });
});

// ── Login ────────────────────────────────────────────────────────────────────
describe("POST /api/auth/login", () => {
    it("logs in the seeded admin and returns user data", async () => {
        const res = await loginAs(app, env.SEED_ADMIN_EMAIL, env.SEED_ADMIN_PASSWORD);

        expect(res.status).toBe(200);
        expect(res.body).toMatchObject({ email: env.SEED_ADMIN_EMAIL, role: "admin" });
        expect(res.body.passwordHash).toBeUndefined();
    });

    it("sets a session cookie on successful login", async () => {
        const res = await loginAs(app, env.SEED_ADMIN_EMAIL, env.SEED_ADMIN_PASSWORD);
        expect(res.headers["set-cookie"]).toBeDefined();
    });

    it("returns 401 for wrong password", async () => {
        const res = await loginAs(app, env.SEED_ADMIN_EMAIL, "wrongpassword");
        expect(res.status).toBe(401);
    });

    it("returns 401 for non-existent email", async () => {
        const res = await loginAs(app, "nobody@test.com", "irrelevant");
        expect(res.status).toBe(401);
    });

    it("returns 400 for missing fields", async () => {
        const res = await request(app)
            .post("/api/auth/login")
            .set(HEADERS)
            .send({ email: env.SEED_ADMIN_EMAIL }); // no password

        expect(res.status).toBe(400);
    });
});

// ── /me ──────────────────────────────────────────────────────────────────────
describe("GET /api/auth/me", () => {
    it("returns the current user when authenticated", async () => {
        const agent = request.agent(app);
        await agent.post("/api/auth/login").set(HEADERS).send({ email: env.SEED_ADMIN_EMAIL, password: env.SEED_ADMIN_PASSWORD });

        const res = await agent.get("/api/auth/me").set(HEADERS);
        expect(res.status).toBe(200);
        expect(res.body.email).toBe(env.SEED_ADMIN_EMAIL);
    });

    it("returns 401 when not authenticated", async () => {
        const res = await request(app).get("/api/auth/me").set(HEADERS);
        expect(res.status).toBe(401);
    });
});

// ── Logout ───────────────────────────────────────────────────────────────────
describe("POST /api/auth/logout", () => {
    it("logs out and session is destroyed", async () => {
        const agent = request.agent(app);
        await agent.post("/api/auth/login").set(HEADERS).send({ email: env.SEED_ADMIN_EMAIL, password: env.SEED_ADMIN_PASSWORD });

        const logout = await agent.post("/api/auth/logout").set(HEADERS);
        expect(logout.status).toBe(200);

        // Subsequent /me should now be unauthenticated
        const me = await agent.get("/api/auth/me").set(HEADERS);
        expect(me.status).toBe(401);
    });

    it("returns 401 when logging out without a session", async () => {
        const res = await request(app).post("/api/auth/logout").set(HEADERS);
        expect(res.status).toBe(401);
    });
});

// ── Security — X-Requested-With header ───────────────────────────────────────
describe("Security: X-Requested-With header enforcement", () => {
    it("returns 403 on POST without X-Requested-With header", async () => {
        const res = await request(app)
            .post("/api/auth/login")
            .send({ email: env.SEED_ADMIN_EMAIL, password: env.SEED_ADMIN_PASSWORD });

        expect(res.status).toBe(403);
    });
});
