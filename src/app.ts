import express from "express";
import cors from "cors";
import helmet from "helmet";
import session from "express-session";
import rateLimit from "express-rate-limit";
import { env, isProd } from "./config/env.js";
import MongoStore from "connect-mongo";
import { requireCustomHeader } from "./middleware/security.js";
import { attachUser } from "./middleware/auth.js";
import { errorHandler, notFoundHandler } from "./middleware/error.js";
import { authRouter } from "./modules/auth/auth.js";

export const SESSION_COOKIE = "anz.session";

export function createApp() {
    const app = express();
    if (isProd) app.set("trust proxy", 1);

    app.use(helmet());
    app.use(cors({
        origin: env.CLIENT_ORIGIN.split(",").map(o => o.trim()),
        credentials: true
    }));
    app.use(express.json());
    app.use(express.urlencoded({ extended: true }));

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
    app.use(requireCustomHeader)
    app.use(attachUser)

    app.get("/api/health", (req, res) => {
        res.json({ status: "ok" });
    });

    app.use("/api/auth", authRouter);

    app.use(notFoundHandler)
    app.use(errorHandler)

    return app;
}