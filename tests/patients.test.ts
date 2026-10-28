/**
 * Patients route integration tests
 * Covers: CRUD operations, RBAC isolation (doctor cannot see, edit, delete, or reassign other doctors' patients),
 * and query filters (status, admit, search, pagination).
 */
import { describe, it, expect, beforeAll, afterAll, afterEach } from "vitest";
import request from "supertest";
import mongoose from "mongoose";
import { createApp } from "../src/app.js";
import { PatientModel } from "../src/db/schema/index.js";
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

// ── GET /api/patients ────────────────────────────────────────────────────────
describe("GET /api/patients", () => {
    it("returns 401 when unauthenticated", async () => {
        const res = await request(app).get("/api/patients").set(HEADERS);
        expect(res.status).toBe(401);
    });

    it("admin can see patients across all doctors", async () => {
        const doc1 = await createTestDoctor({ email: "doc1@test.com" });
        const doc2 = await createTestDoctor({ email: "doc2@test.com" });

        await PatientModel.create({
            name: "Patient One",
            status: "stable",
            gender: "male",
            age: 30,
            description: "Checkup",
            doctors: [doc1.profile._id],
        });
        await PatientModel.create({
            name: "Patient Two",
            status: "ill",
            gender: "female",
            age: 45,
            description: "Fever",
            doctors: [doc2.profile._id],
        });

        const res = await adminAgent.get("/api/patients").set(HEADERS);
        expect(res.status).toBe(200);
        expect(res.body.data.length).toBe(2);
        expect(res.body.pagination.total).toBe(2);
    });

    it("doctor sees ONLY their own patients", async () => {
        const docA = await createTestDoctor({ email: "docA@test.com" });
        const docB = await createTestDoctor({ email: "docB@test.com" });

        await PatientModel.create({
            name: "Patient of Doctor A",
            status: "good",
            gender: "male",
            age: 25,
            description: "Routine",
            doctors: [docA.profile._id],
        });
        await PatientModel.create({
            name: "Patient of Doctor B",
            status: "very-ill",
            gender: "female",
            age: 60,
            description: "Cardiac ICU",
            doctors: [docB.profile._id],
        });

        const agentA = await createAuthenticatedAgent(app, docA.user.email, docA.password);
        const resA = await agentA.get("/api/patients").set(HEADERS);

        expect(resA.status).toBe(200);
        expect(resA.body.data.length).toBe(1);
        expect(resA.body.data[0].name).toBe("Patient of Doctor A");

        // Doctor A cannot see Doctor B's patients even if explicitly asking via query param
        const bypassAttempt = await agentA
            .get(`/api/patients?doctorId=${docB.profile._id}`)
            .set(HEADERS);
        expect(bypassAttempt.status).toBe(200);
        // It strictly forces Doctor A's profile id, ignoring docB filter!
        expect(bypassAttempt.body.data.length).toBe(1);
        expect(bypassAttempt.body.data[0].name).toBe("Patient of Doctor A");
    });

    it("supports search, status, and admit filters", async () => {
        const doc = await createTestDoctor({ email: "docfilter@test.com" });

        await PatientModel.create({
            name: "Alice Asthma",
            status: "very-ill",
            admit: true,
            gender: "female",
            age: 28,
            description: "Acute wheezing",
            doctors: [doc.profile._id],
        });
        await PatientModel.create({
            name: "Bob Broken Arm",
            status: "stable",
            admit: false,
            gender: "male",
            age: 35,
            description: "Fracture cast",
            doctors: [doc.profile._id],
        });

        // Search
        const searchRes = await adminAgent.get("/api/patients?search=Asthma").set(HEADERS);
        expect(searchRes.status).toBe(200);
        expect(searchRes.body.data.length).toBe(1);
        expect(searchRes.body.data[0].name).toBe("Alice Asthma");

        // Status filter
        const statusRes = await adminAgent.get("/api/patients?status=very-ill").set(HEADERS);
        expect(statusRes.status).toBe(200);
        expect(statusRes.body.data.length).toBe(1);
        expect(statusRes.body.data[0].status).toBe("very-ill");

        // Admit filter
        const admitRes = await adminAgent.get("/api/patients?admit=true").set(HEADERS);
        expect(admitRes.status).toBe(200);
        expect(admitRes.body.data.length).toBe(1);
        expect(admitRes.body.data[0].admit).toBe(true);
    });
});

// ── GET /api/patients/:id ────────────────────────────────────────────────────
describe("GET /api/patients/:id", () => {
    it("returns 401 when unauthenticated", async () => {
        const fakeId = new mongoose.Types.ObjectId().toString();
        const res = await request(app).get(`/api/patients/${fakeId}`).set(HEADERS);
        expect(res.status).toBe(401);
    });

    it("returns 400 for an invalid ID", async () => {
        const res = await adminAgent.get("/api/patients/not-an-id").set(HEADERS);
        expect(res.status).toBe(400);
    });

    it("returns 404 for a non-existent patient", async () => {
        const fakeId = new mongoose.Types.ObjectId().toString();
        const res = await adminAgent.get(`/api/patients/${fakeId}`).set(HEADERS);
        expect(res.status).toBe(404);
    });

    it("doctor can view their own patient", async () => {
        const doc = await createTestDoctor({ email: "docown@test.com" });
        const patient = await PatientModel.create({
            name: "My Patient",
            status: "good",
            gender: "male",
            age: 40,
            description: "Healthy",
            doctors: [doc.profile._id],
        });

        const doctorAgent = await createAuthenticatedAgent(app, doc.user.email, doc.password);
        const res = await doctorAgent.get(`/api/patients/${patient._id}`).set(HEADERS);

        expect(res.status).toBe(200);
        expect(res.body.name).toBe("My Patient");
    });

    it("doctor receives 403 when attempting to view another doctor's patient", async () => {
        const doc1 = await createTestDoctor({ email: "doc1@test.com" });
        const doc2 = await createTestDoctor({ email: "doc2@test.com" });

        const patientOfDoc2 = await PatientModel.create({
            name: "Doc 2 Confidential Patient",
            status: "ill",
            gender: "female",
            age: 50,
            description: "Private notes",
            doctors: [doc2.profile._id],
        });

        const doctor1Agent = await createAuthenticatedAgent(app, doc1.user.email, doc1.password);
        const res = await doctor1Agent.get(`/api/patients/${patientOfDoc2._id}`).set(HEADERS);

        expect(res.status).toBe(403);
        expect(res.body.error).toMatch(/access/i);
    });

    it("admin can view any patient regardless of assigned doctor", async () => {
        const doc = await createTestDoctor({ email: "docany@test.com" });
        const patient = await PatientModel.create({
            name: "Any Patient",
            status: "stable",
            gender: "female",
            age: 22,
            description: "General checkup",
            doctors: [doc.profile._id],
        });

        const res = await adminAgent.get(`/api/patients/${patient._id}`).set(HEADERS);
        expect(res.status).toBe(200);
        expect(res.body.name).toBe("Any Patient");
    });
});

// ── POST /api/patients ───────────────────────────────────────────────────────
describe("POST /api/patients", () => {
    const validPatient = {
        name: "Samuel Jackson",
        status: "stable",
        admit: true,
        gender: "male",
        age: 55,
        description: "Post-op monitoring",
    };

    it("returns 401 when unauthenticated", async () => {
        const res = await request(app)
            .post("/api/patients")
            .set(HEADERS)
            .send(validPatient);
        expect(res.status).toBe(401);
    });

    it("returns 400 for validation errors (e.g. invalid status, negative age)", async () => {
        const res = await adminAgent
            .post("/api/patients")
            .set(HEADERS)
            .send({ ...validPatient, status: "critical-invalid", age: -5 });
        expect(res.status).toBe(400);
    });

    it("admin can create patient and assign any doctor", async () => {
        const doc = await createTestDoctor({ email: "docassign@test.com" });

        const res = await adminAgent
            .post("/api/patients")
            .set(HEADERS)
            .send({
                ...validPatient,
                doctors: [doc.profile._id.toString()],
            });

        expect(res.status).toBe(201);
        expect(res.body.name).toBe(validPatient.name);
        expect(res.body.doctors.length).toBe(1);
        expect(res.body.doctors[0]._id.toString()).toBe(doc.profile._id.toString());
    });

    it("doctor creating patient auto-assigns patient to self and ignores other doctor IDs", async () => {
        const currentDoctor = await createTestDoctor({ email: "currentdoc@test.com" });
        const otherDoctor = await createTestDoctor({ email: "otherdoc@test.com" });

        const docAgent = await createAuthenticatedAgent(
            app,
            currentDoctor.user.email,
            currentDoctor.password
        );

        // Doctor attempts to assign otherDoctor
        const res = await docAgent
            .post("/api/patients")
            .set(HEADERS)
            .send({
                ...validPatient,
                name: "Auto Assigned Patient",
                doctors: [otherDoctor.profile._id.toString()],
            });

        expect(res.status).toBe(201);
        expect(res.body.name).toBe("Auto Assigned Patient");
        // Must be assigned to currentDoctor ONLY!
        expect(res.body.doctors.length).toBe(1);
        expect(res.body.doctors[0]._id.toString()).toBe(currentDoctor.profile._id.toString());
    });
});

// ── PUT /api/patients/:id ────────────────────────────────────────────────────
describe("PUT /api/patients/:id", () => {
    it("admin can update any patient and modify doctor assignments", async () => {
        const doc1 = await createTestDoctor({ email: "docorig@test.com" });
        const doc2 = await createTestDoctor({ email: "docnew@test.com" });

        const patient = await PatientModel.create({
            name: "Original Name",
            status: "ill",
            gender: "male",
            age: 33,
            description: "Original description",
            doctors: [doc1.profile._id],
        });

        const res = await adminAgent
            .put(`/api/patients/${patient._id}`)
            .set(HEADERS)
            .send({
                name: "Updated Name",
                status: "good",
                admit: false,
                doctors: [doc2.profile._id.toString()],
            });

        expect(res.status).toBe(200);
        expect(res.body.name).toBe("Updated Name");
        expect(res.body.status).toBe("good");
        expect(res.body.doctors[0]._id.toString()).toBe(doc2.profile._id.toString());
    });

    it("doctor can update their own patient details, but cannot reassign doctor", async () => {
        const myDoc = await createTestDoctor({ email: "mydoc@test.com" });
        const otherDoc = await createTestDoctor({ email: "otherdoc2@test.com" });

        const patient = await PatientModel.create({
            name: "Patient to Update",
            status: "stable",
            gender: "female",
            age: 29,
            description: "Under observation",
            doctors: [myDoc.profile._id],
        });

        const myDocAgent = await createAuthenticatedAgent(
            app,
            myDoc.user.email,
            myDoc.password
        );

        // Attempting to change notes AND reassign doctor to otherDoc
        const res = await myDocAgent
            .put(`/api/patients/${patient._id}`)
            .set(HEADERS)
            .send({
                description: "Updated clinical notes",
                status: "ill",
                doctors: [otherDoc.profile._id.toString()],
            });

        expect(res.status).toBe(200);
        expect(res.body.description).toBe("Updated clinical notes");
        expect(res.body.status).toBe("ill");
        // Doctor assignment must REMAIN myDoc, not otherDoc
        expect(res.body.doctors[0]._id.toString()).toBe(myDoc.profile._id.toString());
    });

    it("doctor receives 403 when attempting to update another doctor's patient", async () => {
        const docA = await createTestDoctor({ email: "docA2@test.com" });
        const docB = await createTestDoctor({ email: "docB2@test.com" });

        const patientB = await PatientModel.create({
            name: "Patient of B",
            status: "stable",
            gender: "male",
            age: 44,
            description: "Notes",
            doctors: [docB.profile._id],
        });

        const agentA = await createAuthenticatedAgent(app, docA.user.email, docA.password);
        const res = await agentA
            .put(`/api/patients/${patientB._id}`)
            .set(HEADERS)
            .send({ status: "very-ill" });

        expect(res.status).toBe(403);
    });
});

// ── DELETE /api/patients/:id ─────────────────────────────────────────────────
describe("DELETE /api/patients/:id", () => {
    it("admin can delete any patient", async () => {
        const doc = await createTestDoctor({ email: "docdel@test.com" });
        const patient = await PatientModel.create({
            name: "Patient to Delete",
            status: "good",
            gender: "female",
            age: 50,
            description: "Desc",
            doctors: [doc.profile._id],
        });

        const res = await adminAgent
            .delete(`/api/patients/${patient._id}`)
            .set(HEADERS);

        expect(res.status).toBe(200);
        expect(res.body.success).toBe(true);

        const checkInDb = await PatientModel.findById(patient._id);
        expect(checkInDb).toBeNull();
    });

    it("doctor can delete their own patient", async () => {
        const doc = await createTestDoctor({ email: "docowndel@test.com" });
        const patient = await PatientModel.create({
            name: "My Patient to Delete",
            status: "stable",
            gender: "male",
            age: 38,
            description: "Desc",
            doctors: [doc.profile._id],
        });

        const docAgent = await createAuthenticatedAgent(app, doc.user.email, doc.password);
        const res = await docAgent
            .delete(`/api/patients/${patient._id}`)
            .set(HEADERS);

        expect(res.status).toBe(200);
        expect(res.body.success).toBe(true);
    });

    it("doctor receives 403 when attempting to delete another doctor's patient", async () => {
        const doc1 = await createTestDoctor({ email: "docdel1@test.com" });
        const doc2 = await createTestDoctor({ email: "docdel2@test.com" });

        const patient2 = await PatientModel.create({
            name: "Patient of Doc 2",
            status: "ill",
            gender: "female",
            age: 62,
            description: "Desc",
            doctors: [doc2.profile._id],
        });

        const doc1Agent = await createAuthenticatedAgent(app, doc1.user.email, doc1.password);
        const res = await doc1Agent
            .delete(`/api/patients/${patient2._id}`)
            .set(HEADERS);

        expect(res.status).toBe(403);

        // Ensure patient was NOT deleted
        const stillInDb = await PatientModel.findById(patient2._id);
        expect(stillInDb).not.toBeNull();
    });
});

