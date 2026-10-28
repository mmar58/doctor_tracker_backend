/**
 * Doctors route integration tests
 * Covers: list, getById, create, update, delete, pagination, search, and RBAC permissions.
 */
import { describe, it, expect, beforeAll, afterAll, afterEach } from "vitest";
import request from "supertest";
import mongoose from "mongoose";
import { createApp } from "../src/app.js";
import { UserModel, DoctorProfile } from "../src/db/schema/index.js";
import { env } from "../src/config/env.js";
import {
    HEADERS,
    type AppType,
    createAuthenticatedAgent,
    createTestDoctor,
    cleanupNonAdminData,
} from "./helper.js";

let app: AppType;
let adminAgent: ReturnType<typeof request.agent>;

beforeAll(async () => {
    if (mongoose.connection.readyState === 0) {
        await mongoose.connect(process.env.MONGODB_URI!);
    }
    app = createApp();
    adminAgent = await createAuthenticatedAgent(
        app,
        env.SEED_ADMIN_EMAIL,
        env.SEED_ADMIN_PASSWORD
    );
});

afterAll(async () => {
    await cleanupNonAdminData();
    await mongoose.disconnect();
});

afterEach(async () => {
    await cleanupNonAdminData();
});

// ── GET /api/doctors ─────────────────────────────────────────────────────────
describe("GET /api/doctors", () => {
    it("returns 401 when not authenticated", async () => {
        const res = await request(app).get("/api/doctors").set(HEADERS);
        expect(res.status).toBe(401);
    });

    it("returns list of doctors when authenticated as admin", async () => {
        await createTestDoctor({ email: "doc1@test.com", name: "Dr. Alpha", hospital: "City General" });
        await createTestDoctor({ email: "doc2@test.com", name: "Dr. Beta", hospital: "Metropolitan" });

        const res = await adminAgent.get("/api/doctors").set(HEADERS);
        expect(res.status).toBe(200);
        expect(res.body.data).toBeInstanceOf(Array);
        expect(res.body.data.length).toBeGreaterThanOrEqual(2);
        expect(res.body.pagination).toBeDefined();
        expect(res.body.pagination.total).toBeGreaterThanOrEqual(2);
    });

    it("allows a doctor to list doctors", async () => {
        const doc = await createTestDoctor({ email: "docself@test.com" });
        const doctorAgent = await createAuthenticatedAgent(app, doc.user.email, doc.password);

        const res = await doctorAgent.get("/api/doctors").set(HEADERS);
        expect(res.status).toBe(200);
        expect(res.body.data).toBeInstanceOf(Array);
    });

    it("supports search query filter by name or hospital", async () => {
        await createTestDoctor({ email: "unique1@test.com", name: "Dr. Gregory Unique", hospital: "St. Jude" });
        await createTestDoctor({ email: "unique2@test.com", name: "Dr. Normal", hospital: "Other Clinic" });

        const res = await adminAgent.get("/api/doctors?search=Unique").set(HEADERS);
        expect(res.status).toBe(200);
        expect(res.body.data.length).toBe(1);
        expect(res.body.data[0].name).toBe("Dr. Gregory Unique");
    });

    it("supports pagination params", async () => {
        await createTestDoctor({ email: "page1@test.com" });
        await createTestDoctor({ email: "page2@test.com" });
        await createTestDoctor({ email: "page3@test.com" });

        const res = await adminAgent.get("/api/doctors?page=1&limit=2").set(HEADERS);
        expect(res.status).toBe(200);
        expect(res.body.data.length).toBe(2);
        expect(res.body.pagination.page).toBe(1);
        expect(res.body.pagination.limit).toBe(2);
        expect(res.body.pagination.totalPages).toBeGreaterThanOrEqual(2);
    });
});

// ── GET /api/doctors/:id ─────────────────────────────────────────────────────
describe("GET /api/doctors/:id", () => {
    it("returns 401 when not authenticated", async () => {
        const fakeId = new mongoose.Types.ObjectId().toString();
        const res = await request(app).get(`/api/doctors/${fakeId}`).set(HEADERS);
        expect(res.status).toBe(401);
    });

    it("returns 400 for an invalid mongo ObjectId", async () => {
        const res = await adminAgent.get("/api/doctors/invalid-id").set(HEADERS);
        expect(res.status).toBe(400);
    });

    it("returns 404 for a non-existent doctor", async () => {
        const nonExistentId = new mongoose.Types.ObjectId().toString();
        const res = await adminAgent.get(`/api/doctors/${nonExistentId}`).set(HEADERS);
        expect(res.status).toBe(404);
    });

    it("returns doctor details with patientCount when found", async () => {
        const doc = await createTestDoctor({
            email: "details@test.com",
            name: "Dr. Detail Specialist",
            hospital: "Central Hospital",
        });

        const res = await adminAgent.get(`/api/doctors/${doc.profile._id}`).set(HEADERS);
        expect(res.status).toBe(200);
        expect(res.body.name).toBe("Dr. Detail Specialist");
        expect(res.body.hospital).toBe("Central Hospital");
        expect(typeof res.body.patientCount).toBe("number");
    });
});

// ── POST /api/doctors ────────────────────────────────────────────────────────
describe("POST /api/doctors", () => {
    const validDoctorPayload = {
        name: "Dr. Sarah Connor",
        email: "sarah.connor@hospital.com",
        password: "SecurePassword123!",
        hospital: "Memorial Medical Center",
        phone: "+1 (555) 333-4444",
    };

    it("returns 401 when not authenticated", async () => {
        const res = await request(app)
            .post("/api/doctors")
            .set(HEADERS)
            .send(validDoctorPayload);
        expect(res.status).toBe(401);
    });

    it("returns 403 when a doctor attempts to create another doctor (admin only)", async () => {
        const doc = await createTestDoctor({ email: "doccreator@test.com" });
        const doctorAgent = await createAuthenticatedAgent(app, doc.user.email, doc.password);

        const res = await doctorAgent
            .post("/api/doctors")
            .set(HEADERS)
            .send(validDoctorPayload);
        expect(res.status).toBe(403);
    });

    it("creates a doctor user and profile when authenticated as admin", async () => {
        const res = await adminAgent
            .post("/api/doctors")
            .set(HEADERS)
            .send(validDoctorPayload);

        expect(res.status).toBe(201);
        expect(res.body.name).toBe(validDoctorPayload.name);
        expect(res.body.email).toBe(validDoctorPayload.email);
        expect(res.body.hospital).toBe(validDoctorPayload.hospital);
        expect(res.body._id).toBeDefined();

        // Verify records in DB
        const createdUser = await UserModel.findOne({ email: validDoctorPayload.email });
        expect(createdUser).toBeDefined();
        expect(createdUser?.role).toBe("doctor");

        const createdProfile = await DoctorProfile.findOne({ userId: createdUser?._id });
        expect(createdProfile).toBeDefined();
        expect(createdProfile?.name).toBe(validDoctorPayload.name);
    });

    it("returns 409 if doctor email already exists", async () => {
        await createTestDoctor({ email: validDoctorPayload.email });

        const res = await adminAgent
            .post("/api/doctors")
            .set(HEADERS)
            .send(validDoctorPayload);

        expect(res.status).toBe(409);
    });

    it("returns 400 when missing required fields or invalid password", async () => {
        const res = await adminAgent
            .post("/api/doctors")
            .set(HEADERS)
            .send({ name: "Dr. Incomplete", email: "incomplete@test.com" }); // missing password and hospital

        expect(res.status).toBe(400);
    });
});

// ── PUT /api/doctors/:id ─────────────────────────────────────────────────────
describe("PUT /api/doctors/:id", () => {
    it("returns 403 when a doctor attempts to update a doctor (admin only)", async () => {
        const doc1 = await createTestDoctor({ email: "doc1@test.com" });
        const doc2 = await createTestDoctor({ email: "doc2@test.com" });
        const doctorAgent = await createAuthenticatedAgent(app, doc1.user.email, doc1.password);

        const res = await doctorAgent
            .put(`/api/doctors/${doc2.profile._id}`)
            .set(HEADERS)
            .send({ hospital: "Hacked Hospital" });

        expect(res.status).toBe(403);
    });

    it("updates doctor profile and user when authenticated as admin", async () => {
        const doc = await createTestDoctor({
            email: "docupdate@test.com",
            name: "Dr. Old Name",
            hospital: "Old Hospital",
        });

        const res = await adminAgent
            .put(`/api/doctors/${doc.profile._id}`)
            .set(HEADERS)
            .send({
                name: "Dr. New Name",
                hospital: "New General Hospital",
                phone: "+1 (555) 999-0000",
                isActive: false,
            });

        expect(res.status).toBe(200);
        expect(res.body.name).toBe("Dr. New Name");
        expect(res.body.hospital).toBe("New General Hospital");
        expect(res.body.isActive).toBe(false);

        // Verify in DB
        const updatedUser = await UserModel.findById(doc.user._id);
        expect(updatedUser?.name).toBe("Dr. New Name");
        expect(updatedUser?.isActive).toBe(false);
    });

    it("returns 404 when updating non-existent doctor", async () => {
        const fakeId = new mongoose.Types.ObjectId().toString();
        const res = await adminAgent
            .put(`/api/doctors/${fakeId}`)
            .set(HEADERS)
            .send({ name: "Dr. Ghost" });

        expect(res.status).toBe(404);
    });
});

// ── DELETE /api/doctors/:id ──────────────────────────────────────────────────
describe("DELETE /api/doctors/:id", () => {
    it("returns 403 when a doctor attempts to delete a doctor (admin only)", async () => {
        const doc = await createTestDoctor({ email: "victim@test.com" });
        const doctorAgent = await createAuthenticatedAgent(app, doc.user.email, doc.password);

        const res = await doctorAgent
            .delete(`/api/doctors/${doc.profile._id}`)
            .set(HEADERS);

        expect(res.status).toBe(403);
    });

    it("deletes doctor profile and user account when authenticated as admin", async () => {
        const doc = await createTestDoctor({ email: "docdelete@test.com" });

        const res = await adminAgent
            .delete(`/api/doctors/${doc.profile._id}`)
            .set(HEADERS);

        expect(res.status).toBe(200);
        expect(res.body.success).toBe(true);

        const profileInDb = await DoctorProfile.findById(doc.profile._id);
        expect(profileInDb).toBeNull();

        const userInDb = await UserModel.findById(doc.user._id);
        expect(userInDb).toBeNull();
    });

    it("returns 404 when deleting non-existent doctor", async () => {
        const fakeId = new mongoose.Types.ObjectId().toString();
        const res = await adminAgent
            .delete(`/api/doctors/${fakeId}`)
            .set(HEADERS);

        expect(res.status).toBe(404);
    });
});

