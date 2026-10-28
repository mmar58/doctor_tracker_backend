export const HEADERS = { "x-requested-with": "XMLHttpRequest" };
import request from "supertest";
import { createApp } from "../src/app";

export type AppType = ReturnType<typeof createApp>;

export async function loginAs(app: AppType, email: string, password: string) {
    const res = await request(app)
        .post("/api/auth/login")
        .set(HEADERS)
        .send({ email, password });
    return res;
}