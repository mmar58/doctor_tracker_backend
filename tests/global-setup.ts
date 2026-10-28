/**
 * Vitest global setup — runs once before all test suites.
 * Connects to the test database, seeds the admin user, and
 * tears down after all tests finish.
 */
import mongoose from "mongoose";
import * as argon2 from "argon2";

const { env } = await import("../src/config/env.js");
const { UserModel } = await import("../src/db/schema/index.js");

export async function setup() {
    await mongoose.connect(env.MONGODB_URI);
    console.log("\n[global-setup] Connected to test DB:", env.MONGODB_URI);

    // Drop legacy unique index on phone if present in test DB
    await mongoose.connection
        .collection("doctorprofiles")
        .dropIndex("phone_1")
        .catch(() => {});

    // Wipe collections for a clean slate
    await Promise.all([
        mongoose.connection.collection("users").deleteMany({}),
        mongoose.connection.collection("sessions").deleteMany({}),
        mongoose.connection.collection("doctorprofiles").deleteMany({}),
        mongoose.connection.collection("patientprofiles").deleteMany({}),
    ]);
    console.log("[global-setup] Cleared test DB collections");

    // Seed the admin user
    const passwordHash = await argon2.hash(env.SEED_ADMIN_PASSWORD);
    await UserModel.create({
        email: env.SEED_ADMIN_EMAIL,
        passwordHash,
        name: env.SEED_ADMIN_NAME,
        role: "admin",
        isActive: true,
    });
    console.log(`[global-setup] Admin seeded: ${env.SEED_ADMIN_EMAIL}`);
}

export async function teardown() {
    // Clean up after all tests
    await Promise.all([
        mongoose.connection.collection("users").deleteMany({}),
        mongoose.connection.collection("sessions").deleteMany({}),
        mongoose.connection.collection("doctorprofiles").deleteMany({}),
        mongoose.connection.collection("patientprofiles").deleteMany({}),
    ]);
    await mongoose.disconnect();
    console.log("[global-setup] Disconnected from test DB");
}
