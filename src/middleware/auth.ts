import { NextFunction, Request, Response } from "express";
import mongoose from "mongoose";
import { forbidden, unauthorized } from "../lib/http.js";
import { UserModel, IUser } from "../db/schema/index.js";

// Load the user from MongoDB by id
async function loadAuthUser(userId: mongoose.Types.ObjectId) {
    return UserModel.findById(userId).lean<IUser & { _id: mongoose.Types.ObjectId }>();
}

// Attaches req.user when a valid session exists. Never rejects — pass-through middleware.
export async function attachUser(req: Request, _res: Response, next: NextFunction) {
    try {
        const rawId = req.session?.userId;
        if (rawId && mongoose.Types.ObjectId.isValid(rawId)) {
            const user = await loadAuthUser(new mongoose.Types.ObjectId(rawId));
            if (user && user.isActive) {
                req.user = user;
            }
        }
        next();
    } catch (err) {
        next(err);
    }
}

// Strictly requires an authenticated session. Throws 401 otherwise.
export function requireAuth(req: Request, _res: Response, next: NextFunction) {
    if (!req.user) return next(unauthorized());
    next();
}

// Requires the authenticated user to have a specific role. Must be used after requireAuth.
export function requireRole(...roles: Array<IUser["role"]>) {
    return (req: Request, _res: Response, next: NextFunction) => {
        if (!req.user) return next(unauthorized());
        if (!roles.includes(req.user.role)) return next(forbidden());
        next();
    };
}
