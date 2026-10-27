import express from "express";
import cors from "cors";
import helmet from "helmet";
import session from "express-session";
import rateLimit from "express-rate-limit";
import { env, isProd } from "./config/env.js";
import MongoStore from "connect-mongo";

export const SESSION_COOKIE = "anz.session";

export function createApp() {
    const app = express();
    if (isProd) app.set("trust proxy", 1);

    app.use(helmet());
    app.use(cors({
        origin: env.CLIENT_ORIGIN.split(",").map(o => o.trim()),
        credentials: true
    }));

    const maxAge = env.SESSION_MAX_AGE_DAYS * 24 * 60 * 60 * 1000;

    const store = MongoStore.create({
        mongoUrl: env.MONGODB_URI,
        collectionName: "sessions",
        ttl: env.SESSION_MAX_AGE_DAYS * 24 * 60 * 60, // in seconds
        autoRemove: "interval",
        autoRemoveInterval: 15, // minutes
    });

    app.use(session({
        name: SESSION_COOKIE,
        store: store,
        secret: env.SESSION_SECRET,
        resave: false,
        saveUninitialized: false,
        rolling: true,
        cookie: { httpOnly: true, sameSite: "lax", secure: isProd, maxAge },
    }))

    app.get("/api/health", (req, res) => {
        res.json({ status: "ok" });
    });
    return app;
}