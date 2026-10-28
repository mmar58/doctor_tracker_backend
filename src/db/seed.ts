import mongoose from "mongoose";
import * as argon2 from "argon2";
import { env } from "../config/env.js";
import { UserModel } from "./schema/index.js";

async function seed() {
    await mongoose.connect(env.MONGODB_URI);
    console.log("MongoDB connected for seeding");

    const existing = await UserModel.findOne({ email: env.SEED_ADMIN_EMAIL });

    if (existing) {
        console.log(`Admin user already exists: ${env.SEED_ADMIN_EMAIL}`);
    } else {
        const passwordHash = await argon2.hash(env.SEED_ADMIN_PASSWORD);
        await UserModel.create({
            email: env.SEED_ADMIN_EMAIL,
            passwordHash,
            name: env.SEED_ADMIN_NAME,
            role: "admin",
            isActive: true,
        });
        console.log(`Admin user created: ${env.SEED_ADMIN_EMAIL}`);
    }

    await mongoose.disconnect();
    console.log("Seeding complete");
}

seed().catch((err) => {
    console.error("Seed failed:", err);
    process.exit(1);
});

