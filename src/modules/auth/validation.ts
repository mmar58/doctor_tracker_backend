import { z } from "zod";

export const RegisterSchema = z.object({
    name: z.string().min(1).max(100),
    email: z.string().email().max(255),
    password: z.string().min(8).max(72), // argon2 max is 72 bytes
});

export const LoginSchema = z.object({
    email: z.string().email(),
    password: z.string().min(1),
});