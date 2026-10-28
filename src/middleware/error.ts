import type { ErrorRequestHandler, NextFunction, Request, RequestHandler, Response } from "express";
import { ZodError, z } from "zod";
import { HttpError } from "../lib/http.js";
import { isProd } from "../config/env.js";

export const notFoundHandler: RequestHandler = (_req, _res, next) => next(new HttpError(404, "Route not found"));

export const errorHandler: ErrorRequestHandler = (err, _req: Request, res: Response, _next: NextFunction) => {
    if (err instanceof ZodError) {
        return res.status(400).json({
            error: "Validation failed",
            details: z.flattenError(err).fieldErrors,
        });
    }
    if (err instanceof HttpError) {
        return res.status(err.status).json({ error: err.message, details: err.details });
    }
    if (err?.type === "entity.parse.failed") {
        return res.status(400).json({ error: "Invalid JSON body" });
    }
    console.error(err);
    res.status(500).json({ error: "Internal server error", ...(isProd ? {} : { message: String(err?.message ?? err) }) });
};
