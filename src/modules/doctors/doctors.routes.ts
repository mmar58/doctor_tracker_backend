import { Router } from "express";
import { requireAuth, requireRole } from "../../middleware/auth.js";
import { CreateDoctorSchema, UpdateDoctorSchema, QueryDoctorsSchema } from "./doctors.validation.js";
import * as doctorsService from "./doctors.service.js";

export const doctorsRouter = Router();

// List doctors (auth required)
doctorsRouter.get("/", requireAuth, async (req, res, next) => {
    try {
        const query = QueryDoctorsSchema.parse(req.query);
        const result = await doctorsService.listDoctors(query);
        res.json(result);
    } catch (err) {
        next(err);
    }
});

// Get single doctor by ID
doctorsRouter.get("/:id", requireAuth, async (req, res, next) => {
    try {
        const id = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
        const doctor = await doctorsService.getDoctorById(id);
        res.json(doctor);
    } catch (err) {
        next(err);
    }
});

// Create doctor (admin only)
doctorsRouter.post("/", requireAuth, requireRole("admin"), async (req, res, next) => {
    try {
        const input = CreateDoctorSchema.parse(req.body);
        const doctor = await doctorsService.createDoctor(input);
        res.status(201).json(doctor);
    } catch (err) {
        next(err);
    }
});

// Update doctor (admin only)
doctorsRouter.put("/:id", requireAuth, requireRole("admin"), async (req, res, next) => {
    try {
        const id = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
        const input = UpdateDoctorSchema.parse(req.body);
        const doctor = await doctorsService.updateDoctor(id, input);
        res.json(doctor);
    } catch (err) {
        next(err);
    }
});

// Delete doctor (admin only)
doctorsRouter.delete("/:id", requireAuth, requireRole("admin"), async (req, res, next) => {
    try {
        const id = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
        const result = await doctorsService.deleteDoctor(id);
        res.json(result);
    } catch (err) {
        next(err);
    }
});
