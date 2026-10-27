import "dotenv/config";
import { z } from "zod";

const schema = z.object({
    // General
    NODE_ENV: z.enum(["development", "test", "production"]).default("production"),
    PORT: z.coerce.number().default(4000),
    CLIENT_ORIGIN: z.string().default("http://localhost:3000"),

    // Database
    MONGODB_URI: z.string(),

    // Session
    SESSION_SECRET: z.string().default("change-me-to-a-long-random-string"),
    SESSION_MAX_AGE_DAYS: z.coerce.number().default(7),

    // Seed Admin
    SEED_ADMIN_NAME: z.string().default("AnZ Admin"),
    SEED_ADMIN_EMAIL: z.string().default("admin@test.com"),
    SEED_ADMIN_PASSWORD: z.string().default("test123")
})

const parsed = schema.safeParse(process.env);

if (!parsed.success) {
    console.error("Invalid environment variables:", z.prettifyError(parsed.error));
    process.exit(1);
}

export const env = parsed.data;

export const isDev = env.NODE_ENV === "development";
export const isTest = env.NODE_ENV === "test";
export const isProd = env.NODE_ENV === "production";