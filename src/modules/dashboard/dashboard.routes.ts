import { Router } from "express";
import { requireAuth, requireRole } from "../../middleware/auth.js";
import { DashboardQuerySchema } from "./dashboard.validation.js";
import * as dashboardService from "./dashboard.service.js";

export const dashboardRouter = Router();

// Admin dashboard statistics
dashboardRouter.get("/admin", requireAuth, requireRole("admin"), async (req, res, next) => {
    try {
        const query = DashboardQuerySchema.parse(req.query);
        const stats = await dashboardService.getAdminDashboardStats(query.days);
        res.json(stats);
    } catch (err) {
        next(err);
    }
});

// Doctor dashboard statistics
dashboardRouter.get("/doctor", requireAuth, requireRole("doctor", "admin"), async (req, res, next) => {
    try {
        const query = DashboardQuerySchema.parse(req.query);
        const stats = await dashboardService.getDoctorDashboardStats(req.user!._id, query.days);
        res.json(stats);
    } catch (err) {
        next(err);
    }
});

