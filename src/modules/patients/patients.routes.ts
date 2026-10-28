import { Router } from "express";
import { requireAuth } from "../../middleware/auth.js";
import { CreatePatientSchema, UpdatePatientSchema, QueryPatientsSchema } from "./patients.validation.js";
import * as patientsService from "./patients.service.js";

export const patientsRouter = Router();

// List patients — doctors see only their own; admins see all (with optional doctorId filter)
patientsRouter.get("/", requireAuth, async (req, res, next) => {
    try {
        const query = QueryPatientsSchema.parse(req.query);
        const result = await patientsService.listPatients(query, req.user);
        res.json(result);
    } catch (err) {
        next(err);
    }
});

// Get single patient — doctors may only access patients assigned to them
patientsRouter.get("/:id", requireAuth, async (req, res, next) => {
    try {
        const id = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
        const patient = await patientsService.getPatientById(id, req.user);
        res.json(patient);
    } catch (err) {
        next(err);
    }
});

// Create patient — doctor: auto-assigned to themselves; admin: can assign any doctor
patientsRouter.post("/", requireAuth, async (req, res, next) => {
    try {
        const input = CreatePatientSchema.parse(req.body);
        const patient = await patientsService.createPatient(input, req.user);
        res.status(201).json(patient);
    } catch (err) {
        next(err);
    }
});

// Update patient — doctor: own patients only, no reassigning; admin: full control
patientsRouter.put("/:id", requireAuth, async (req, res, next) => {
    try {
        const id = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
        const input = UpdatePatientSchema.parse(req.body);
        const patient = await patientsService.updatePatient(id, input, req.user);
        res.json(patient);
    } catch (err) {
        next(err);
    }
});

// Delete patient — doctor: own patients only; admin: any patient
patientsRouter.delete("/:id", requireAuth, async (req, res, next) => {
    try {
        const id = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
        const result = await patientsService.deletePatient(id, req.user);
        res.json(result);
    } catch (err) {
        next(err);
    }
});
