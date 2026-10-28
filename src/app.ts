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
import { dashboardRouter } from "./modules/dashboard/dashboard.routes.js";
import { doctorsRouter } from "./modules/doctors/doctors.routes.js";
import { patientsRouter } from "./modules/patients/patients.routes.js";

export const SESSION_COOKIE = "anz.session";

export function createApp() {
    const app = express();

    // Trust reverse proxy (e.g. Nginx, Caddy, Cloudflare, load balancers on VPS)
    if (isProd) {
        app.set("trust proxy", 1);
    }

    // Security headers: allow cross-origin requests for resources (essential for cross-domain frontend/backend)
    app.use(
        helmet({
            crossOriginResourcePolicy: { policy: "cross-origin" },
        })
    );

    // Normalize configured client origins (stripping trailing slashes and spaces)
    const allowedOrigins = env.CLIENT_ORIGIN.split(",")
        .map((o) => o.trim().replace(/\/+$/, ""))
        .filter(Boolean);

    app.use(
        cors({
            origin: (origin, callback) => {
                // Allow requests with no origin (like mobile apps, curl, server-to-server)
                if (!origin) return callback(null, true);
                const normalized = origin.replace(/\/+$/, "");
                if (allowedOrigins.includes(normalized) || allowedOrigins.includes("*")) {
                    return callback(null, true);
                }
                return callback(new Error(`CORS blocked for origin: ${origin}`));
            },
            credentials: true,
            methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
            allowedHeaders: ["Content-Type", "Authorization", "X-Requested-With", "Accept"],
            exposedHeaders: ["Set-Cookie"],
        })
    );

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

    const sameSite = isProd ? "none" : "lax";
    const secure = isProd ? true : false;

    app.use(
        session({
            name: SESSION_COOKIE,
            store: store,
            secret: env.SESSION_SECRET,
            resave: false,
            saveUninitialized: false,
            rolling: true,
            proxy: isProd || sameSite === "none", // Instructs express-session to trust X-Forwarded-Proto
            cookie: {
                httpOnly: true,
                sameSite,
                secure,
                maxAge,
            },
        })
    );

    app.use(requireCustomHeader);
    app.use(attachUser);

    app.get("/api/health", (_req, res) => {
        res.json({ status: "ok" });
    });

    // Rate limiters
    const authLimiter = rateLimit({
        windowMs: 1 * 60 * 1000,
        max: 60,
        standardHeaders: "draft-8",
        legacyHeaders: false,
    });

    // Modules
    app.use("/api/auth", authLimiter, authRouter);
    app.use("/api/dashboard", dashboardRouter);
    app.use("/api/doctors", doctorsRouter);
    app.use("/api/patients", patientsRouter);

    app.use(notFoundHandler);
    app.use(errorHandler);

    return app;
}
