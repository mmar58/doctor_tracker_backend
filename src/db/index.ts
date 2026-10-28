import mongoose from "mongoose";
import { env } from "../config/env.js";

export async function createDB() {
    await mongoose.connect(env.MONGODB_URI);
    console.log("MongoDB connected");
}

export * from "./schema/index.js";