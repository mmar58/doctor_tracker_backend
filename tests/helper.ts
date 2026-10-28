import request from "supertest";
import * as argon2 from "argon2";
import { createApp } from "../src/app.js";
import { UserModel, DoctorProfile, PatientModel } from "../src/db/schema/index.js";
import { env } from "../src/config/env.js";

export const HEADERS = { "x-requested-with": "XMLHttpRequest" };

export type AppType = ReturnType<typeof createApp>;

let doctorSeq = 0;

export async function loginAs(app: AppType, email: string, password: string) {
    const res = await request(app)
        .post("/api/auth/login")
        .set(HEADERS)
        .send({ email, password });
    return res;
}

export async function createAuthenticatedAgent(app: AppType, email: string, password: string) {
    const agent = request.agent(app);
    const res = await agent
        .post("/api/auth/login")
        .set(HEADERS)
        .send({ email, password });
    if (res.status !== 200) {
        throw new Error(`Failed to login as ${email}: ${res.status} ${JSON.stringify(res.body)}`);
    }
    return agent;
}

export async function createTestDoctor(data: {
    name?: string;
    email: string;
    password?: string;
    hospital?: string;
    phone?: string;
}) {
    doctorSeq++;
    const name = data.name ?? `Test Doctor ${doctorSeq}`;
    const password = data.password ?? "DoctorPass123!";
    const hospital = data.hospital ?? "City General Hospital";
    const phone = data.phone ?? `+1555${String(doctorSeq).padStart(4, "0")}${Math.floor(100 + Math.random() * 900)}`;

    const passwordHash = await argon2.hash(password);
    const user = await UserModel.create({
        name,
        email: data.email,
        passwordHash,
        role: "doctor",
        isActive: true,
    });

    const profile = await DoctorProfile.create({
        userId: user._id,
        name,
        hospital,
        phone,
        specialization: [],
    });

    return { user, profile, password };
}

export async function cleanupNonAdminData() {
    await UserModel.deleteMany({ email: { $ne: env.SEED_ADMIN_EMAIL } });
    await DoctorProfile.deleteMany({});
    await PatientModel.deleteMany({});
}