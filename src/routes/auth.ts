import { Router } from "express";
import * as argon2 from "argon2";
import { z } from "zod";
import { UserModel } from "../db/schema/index.js";
import { badRequest, conflict, unauthorized } from "../lib/http.js";
import { requireAuth } from "../middleware/auth.js";

export const authRouter = Router();

// ── Validation schemas ──────────────────────────────────────────────────────

const RegisterSchema = z.object({
    name: z.string().min(1).max(100),
    email: z.string().email().max(255),
    password: z.string().min(8).max(72), // argon2 max is 72 bytes
});

const LoginSchema = z.object({
    email: z.string().email(),
    password: z.string().min(1),
});

// ── POST /api/auth/register ─────────────────────────────────────────────────

authRouter.post("/register", async (req, res, next) => {
    try {
        const body = RegisterSchema.parse(req.body);

        // Block self-assigned admin role
        if ((req.body as Record<string, unknown>).role === "admin") {
            return next(badRequest("Cannot assign admin role during registration"));
        }

        const exists = await UserModel.findOne({ email: body.email }).lean();
        if (exists) return next(conflict("Email already in use"));

        const passwordHash = await argon2.hash(body.password);
        const user = await UserModel.create({
            name: body.name,
            email: body.email,
            passwordHash,
            role: "doctor",   // always doctor — admin only via seed
            isActive: true,
        });

        req.session.userId = String(user._id);

        res.status(201).json({
            id: user._id,
            name: user.name,
            email: user.email,
            role: user.role,
        });
    } catch (err) {
        next(err);
    }
});

// ── POST /api/auth/login ────────────────────────────────────────────────────

authRouter.post("/login", async (req, res, next) => {
    try {
        const body = LoginSchema.parse(req.body);

        const user = await UserModel.findOne({ email: body.email });
        if (!user || !user.isActive) return next(unauthorized("Invalid credentials"));

        const valid = await argon2.verify(user.passwordHash, body.password);
        if (!valid) return next(unauthorized("Invalid credentials"));

        req.session.userId = String(user._id);

        res.json({
            id: user._id,
            name: user.name,
            email: user.email,
            role: user.role,
        });
    } catch (err) {
        next(err);
    }
});

// ── POST /api/auth/logout ───────────────────────────────────────────────────

authRouter.post("/logout", requireAuth, (req, res, next) => {
    req.session.destroy((err) => {
        if (err) return next(err);
        res.json({ message: "Logged out" });
    });
});

// ── GET /api/auth/me ────────────────────────────────────────────────────────

authRouter.get("/me", requireAuth, (req, res) => {
    const u = req.user!;
    res.json({
        id: u._id,
        name: u.name,
        email: u.email,
        role: u.role,
    });
});

