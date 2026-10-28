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

    // Wipe the users and sessions collections for a clean slate
    await mongoose.connection.collection("users").deleteMany({});
    await mongoose.connection.collection("sessions").deleteMany({});
    console.log("[global-setup] Cleared users and sessions collections");

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
    await mongoose.connection.collection("users").deleteMany({});
    await mongoose.connection.collection("sessions").deleteMany({});
    await mongoose.disconnect();
    console.log("[global-setup] Disconnected from test DB");
}

