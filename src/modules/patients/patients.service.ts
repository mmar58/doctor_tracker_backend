import mongoose from "mongoose";
import { PatientModel, DoctorProfile } from "../../db/schema/index.js";
import { badRequest, forbidden, notFound } from "../../lib/http.js";
import { CreatePatientInput, UpdatePatientInput, QueryPatientsInput } from "./patients.validation.js";

type CurrentUser = { _id: mongoose.Types.ObjectId; role: "admin" | "doctor" };

// Resolve the DoctorProfile _id for the currently logged-in doctor user.
// Throws 403 if the user has no profile yet (doctor must be set up by admin first).
async function resolveOwnProfile(userId: mongoose.Types.ObjectId) {
    const profile = await DoctorProfile.findOne({ userId }).select("_id").lean();
    if (!profile) throw forbidden("Your doctor profile has not been set up yet. Contact an admin.");
    return profile._id as mongoose.Types.ObjectId;
}

// Assert that a patient is actually assigned to the requesting doctor.
async function assertDoctorOwnsPatient(
    patientId: mongoose.Types.ObjectId,
    doctorProfileId: mongoose.Types.ObjectId
) {
    const exists = await PatientModel.exists({
        _id: patientId,
        doctors: doctorProfileId,
    });
    if (!exists) throw forbidden("You do not have access to this patient.");
}

// ── listPatients ─────────────────────────────────────────────────────────────
export async function listPatients(query: QueryPatientsInput, currentUser?: CurrentUser) {
    const { search, status, admit, gender, page, limit } = query;
    let { doctorId } = query;
    const skip = (page - 1) * limit;

    const filter: Record<string, unknown> = {};

    if (currentUser?.role === "doctor") {
        // Doctors always see ONLY their own patients — ignore any doctorId query param.
        const profileId = await resolveOwnProfile(currentUser._id);
        filter.doctors = profileId;
    } else if (doctorId && mongoose.Types.ObjectId.isValid(doctorId)) {
        // Admin may optionally filter by any doctor.
        filter.doctors = new mongoose.Types.ObjectId(doctorId);
    }

    if (search) {
        const regex = new RegExp(search, "i");
        filter.$or = [{ name: regex }, { description: regex }];
    }
    if (status) filter.status = status;
    if (typeof admit === "boolean") filter.admit = admit;
    if (gender) filter.gender = gender;

    const [total, patients] = await Promise.all([
        PatientModel.countDocuments(filter),
        PatientModel.find(filter)
            .populate({
                path: "doctors",
                select: "name hospital phone specialization",
                populate: { path: "specialization", select: "name" },
            })
            .sort({ createdAt: -1 })
            .skip(skip)
            .limit(limit)
            .lean(),
    ]);

    return {
        data: patients,
        pagination: {
            total,
            page,
            limit,
            totalPages: Math.ceil(total / limit) || 1,
        },
    };
}

// ── getPatientById ────────────────────────────────────────────────────────────
export async function getPatientById(id: string, currentUser?: CurrentUser) {
    if (!mongoose.Types.ObjectId.isValid(id)) throw badRequest("Invalid patient ID");

    const patient = await PatientModel.findById(id)
        .populate({
            path: "doctors",
            select: "name hospital phone specialization",
            populate: { path: "specialization", select: "name" },
        })
        .lean();

    if (!patient) throw notFound("Patient not found");

    // Doctors may only view their own patients.
    if (currentUser?.role === "doctor") {
        const profileId = await resolveOwnProfile(currentUser._id);
        await assertDoctorOwnsPatient(
            patient._id as mongoose.Types.ObjectId,
            profileId
        );
    }

    return patient;
}

// ── createPatient ─────────────────────────────────────────────────────────────
export async function createPatient(input: CreatePatientInput, currentUser?: CurrentUser) {
    let doctorObjectIds: mongoose.Types.ObjectId[];

    if (currentUser?.role === "doctor") {
        // Doctors are always and only assigned to themselves — ignore any `doctors` field.
        const profileId = await resolveOwnProfile(currentUser._id);
        doctorObjectIds = [profileId];
    } else {
        // Admin: use provided list (may be empty).
        doctorObjectIds = input.doctors
            .filter((d) => mongoose.Types.ObjectId.isValid(d))
            .map((d) => new mongoose.Types.ObjectId(d));
    }

    const patient = await PatientModel.create({
        name: input.name,
        status: input.status,
        admit: input.admit,
        gender: input.gender,
        age: input.age,
        description: input.description,
        doctors: doctorObjectIds,
    });

    return PatientModel.findById(patient._id)
        .populate({ path: "doctors", select: "name hospital phone" })
        .lean();
}

// ── updatePatient ─────────────────────────────────────────────────────────────
export async function updatePatient(
    id: string,
    input: UpdatePatientInput,
    currentUser?: CurrentUser
) {
    if (!mongoose.Types.ObjectId.isValid(id)) throw badRequest("Invalid patient ID");

    const patient = await PatientModel.findById(id);
    if (!patient) throw notFound("Patient not found");

    // Doctors may only edit their own patients and cannot reassign doctors.
    if (currentUser?.role === "doctor") {
        const profileId = await resolveOwnProfile(currentUser._id);
        await assertDoctorOwnsPatient(patient._id as mongoose.Types.ObjectId, profileId);
        // Strip any doctors field — doctor cannot change assignment.
        delete input.doctors;
    }

    if (input.name) patient.name = input.name;
    if (input.status) patient.status = input.status;
    if (typeof input.admit === "boolean") patient.admit = input.admit;
    if (input.gender) patient.gender = input.gender;
    if (typeof input.age === "number") patient.age = input.age;
    if (input.description) patient.description = input.description;

    // Only admin can change doctor assignment.
    if (input.doctors) {
        patient.doctors = input.doctors
            .filter((d) => mongoose.Types.ObjectId.isValid(d))
            .map((d) => new mongoose.Types.ObjectId(d));
    }

    await patient.save();

    return PatientModel.findById(patient._id)
        .populate({ path: "doctors", select: "name hospital phone" })
        .lean();
}

// ── deletePatient ─────────────────────────────────────────────────────────────
export async function deletePatient(id: string, currentUser?: CurrentUser) {
    if (!mongoose.Types.ObjectId.isValid(id)) throw badRequest("Invalid patient ID");

    // Doctors may only delete their own patients.
    if (currentUser?.role === "doctor") {
        const profileId = await resolveOwnProfile(currentUser._id);
        const patient = await PatientModel.findById(id).select("_id").lean();
        if (!patient) throw notFound("Patient not found");
        await assertDoctorOwnsPatient(patient._id as mongoose.Types.ObjectId, profileId);
    }

    const patient = await PatientModel.findByIdAndDelete(id);
    if (!patient) throw notFound("Patient not found");

    return { success: true, message: "Patient deleted successfully" };
}
