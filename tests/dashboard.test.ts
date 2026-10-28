/**
 * Dashboard route integration tests
 * Covers: Admin and Doctor statistics endpoints, RBAC permissions,
 * query filtering by day ranges, and aggregation accuracy.
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

// ── GET /api/dashboard/admin ─────────────────────────────────────────────────
describe("GET /api/dashboard/admin", () => {
    it("returns 401 when not authenticated", async () => {
        const res = await request(app).get("/api/dashboard/admin").set(HEADERS);
        expect(res.status).toBe(401);
    });

    it("returns 403 when a doctor attempts to access admin dashboard", async () => {
        const doc = await createTestDoctor({ email: "docdashboard@test.com" });
        const doctorAgent = await createAuthenticatedAgent(app, doc.user.email, doc.password);

        const res = await doctorAgent.get("/api/dashboard/admin").set(HEADERS);
        expect(res.status).toBe(403);
    });

    it("returns complete aggregated statistics for admin", async () => {
        const doc1 = await createTestDoctor({ email: "docstats1@test.com", name: "Dr. Alpha" });
        const doc2 = await createTestDoctor({ email: "docstats2@test.com", name: "Dr. Beta" });

        await PatientModel.create({
            name: "Patient Admitted",
            status: "very-ill",
            admit: true,
            gender: "male",
            age: 45,
            description: "Heart ICU",
            doctors: [doc1.profile._id],
        });
        await PatientModel.create({
            name: "Patient Outpatient",
            status: "good",
            admit: false,
            gender: "female",
            age: 28,
            description: "Checkup",
            doctors: [doc1.profile._id],
        });
        await PatientModel.create({
            name: "Patient Beta",
            status: "stable",
            admit: false,
            gender: "male",
            age: 35,
            description: "Consultation",
            doctors: [doc2.profile._id],
        });

        const res = await adminAgent.get("/api/dashboard/admin").set(HEADERS);

        expect(res.status).toBe(200);

        // Overview KPI checks
        expect(res.body.overview).toBeDefined();
        expect(res.body.overview.totalDoctors).toBe(2);
        expect(res.body.overview.totalPatients).toBe(3);
        expect(res.body.overview.totalAdmitted).toBe(1);
        expect(res.body.overview.totalOutpatient).toBe(2);
        expect(res.body.overview.avgPatientsPerDoctor).toBe(1.5);

        // Patients per doctor chart data
        expect(res.body.patientsPerDoctor).toBeInstanceOf(Array);
        expect(res.body.patientsPerDoctor.length).toBe(2);
        const topDoctor = res.body.patientsPerDoctor[0];
        expect(topDoctor.patientCount).toBe(2);
        expect(topDoctor.doctorName).toBe("Dr. Alpha");

        // Date-based timeline continuous array (default 30 days)
        expect(res.body.dateBasedStats).toBeInstanceOf(Array);
        expect(res.body.dateBasedStats.length).toBe(30);

        // Status distribution
        expect(res.body.statusDistribution).toBeInstanceOf(Array);
        const veryIll = res.body.statusDistribution.find((s: { status: string }) => s.status === "very-ill");
        expect(veryIll?.count).toBe(1);

        // Recent records
        expect(res.body.recentPatients).toBeInstanceOf(Array);
        expect(res.body.recentDoctors).toBeInstanceOf(Array);
    });

    it("respects the ?days parameter for date-based statistics", async () => {
        const res = await adminAgent.get("/api/dashboard/admin?days=7").set(HEADERS);
        expect(res.status).toBe(200);
        expect(res.body.dateBasedStats.length).toBe(7);
    });
});

// ── GET /api/dashboard/doctor ────────────────────────────────────────────────
describe("GET /api/dashboard/doctor", () => {
    it("returns 401 when not authenticated", async () => {
        const res = await request(app).get("/api/dashboard/doctor").set(HEADERS);
        expect(res.status).toBe(401);
    });

    it("returns caseload statistics scoped exclusively to the logged-in doctor", async () => {
        const myDoc = await createTestDoctor({
            email: "mycare@test.com",
            name: "Dr. Gregory House",
            hospital: "Princeton Hospital",
        });
        const otherDoc = await createTestDoctor({ email: "othercare@test.com" });

        // Patients for myDoc
        await PatientModel.create({
            name: "My Critical Patient",
            status: "very-ill",
            admit: true,
            gender: "male",
            age: 50,
            description: "High priority",
            doctors: [myDoc.profile._id],
        });
        await PatientModel.create({
            name: "My Stable Patient",
            status: "stable",
            admit: false,
            gender: "female",
            age: 32,
            description: "Follow-up",
            doctors: [myDoc.profile._id],
        });

        // Patient for otherDoc (should NOT be counted in myDoc's stats)
        await PatientModel.create({
            name: "Other Doc Patient",
            status: "very-ill",
            admit: true,
            gender: "male",
            age: 70,
            description: "Not mine",
            doctors: [otherDoc.profile._id],
        });

        const myDocAgent = await createAuthenticatedAgent(
            app,
            myDoc.user.email,
            myDoc.password
        );

        const res = await myDocAgent.get("/api/dashboard/doctor").set(HEADERS);

        expect(res.status).toBe(200);

        // Doctor profile summary
        expect(res.body.doctorProfile.name).toBe("Dr. Gregory House");
        expect(res.body.doctorProfile.hospital).toBe("Princeton Hospital");

        // Caseload KPIs
        expect(res.body.overview.totalPatients).toBe(2); // Only myDoc's patients!
        expect(res.body.overview.totalAdmitted).toBe(1);
        expect(res.body.overview.totalOutpatient).toBe(1);
        expect(res.body.overview.criticalCount).toBe(1); // very-ill
        expect(res.body.overview.stableCount).toBe(1);   // stable

        // Date-based stats default to 30 continuous entries
        expect(res.body.dateBasedStats.length).toBe(30);

        // Recent patients contains ONLY myDoc's patients
        expect(res.body.recentPatients.length).toBe(2);
        const names = res.body.recentPatients.map((p: { name: string }) => p.name);
        expect(names).toContain("My Critical Patient");
        expect(names).toContain("My Stable Patient");
        expect(names).not.toContain("Other Doc Patient");
    });

    it("respects the ?days parameter for doctor date-based statistics", async () => {
        const doc = await createTestDoctor({ email: "docrange@test.com" });
        const docAgent = await createAuthenticatedAgent(app, doc.user.email, doc.password);

        const res = await docAgent.get("/api/dashboard/doctor?days=14").set(HEADERS);
        expect(res.status).toBe(200);
        expect(res.body.dateBasedStats.length).toBe(14);
    });

    it("allows admin to call doctor dashboard endpoint", async () => {
        const res = await adminAgent.get("/api/dashboard/doctor").set(HEADERS);
        expect(res.status).toBe(200);
        expect(res.body.overview).toBeDefined();
    });
});

