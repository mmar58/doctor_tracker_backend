import { RequestHandler } from "express";
import { HttpError } from "../lib/http.js";
// Every state-changing request must carry a custom header (which forces a CORS preflight).
export const requireCustomHeader: RequestHandler = (req, _res, next) => {
    const safe = ["GET", "HEAD", "OPTIONS"].includes(req.method);
    if (!safe && req.header("x-requested-with") !== "XMLHttpRequest") {
        return next(new HttpError(403, "Missing X-Requested-With header"));
    }
    next();
};