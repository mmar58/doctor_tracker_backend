import mongoose from "mongoose";
import * as argon2 from "argon2";
import { UserModel, DoctorProfile, PatientModel } from "../../db/schema/index.js";
import { badRequest, conflict, notFound } from "../../lib/http.js";
import { CreateDoctorInput, UpdateDoctorInput, QueryDoctorsInput } from "./doctors.validation.js";

export async function listDoctors(query: QueryDoctorsInput) {
    const { search, page, limit } = query;
    const skip = (page - 1) * limit;

    const filter: Record<string, unknown> = {};
    if (search) {
        const regex = new RegExp(search, "i");
        filter.$or = [{ name: regex }, { hospital: regex }, { phone: regex }];
    }

    const [total, doctors] = await Promise.all([
        DoctorProfile.countDocuments(filter),
        DoctorProfile.find(filter)
            .populate({ path: "userId", select: "email isActive createdAt" })
            .populate("specialization")
            .sort({ createdAt: -1 })
            .skip(skip)
            .limit(limit)
            .lean(),
    ]);

    // Fast batch count of patients per doctor
    const doctorIds = doctors.map((d) => d._id);
    const patientCounts = await PatientModel.aggregate([
        { $match: { doctors: { $in: doctorIds } } },
        { $unwind: "$doctors" },
        { $match: { doctors: { $in: doctorIds } } },
        { $group: { _id: "$doctors", count: { $sum: 1 } } },
    ]);

    const countMap = new Map<string, number>();
    patientCounts.forEach((c) => countMap.set(String(c._id), c.count));

    const enrichedDoctors = doctors.map((doc) => ({
        ...doc,
        patientCount: countMap.get(String(doc._id)) ?? 0,
    }));

    return {
        data: enrichedDoctors,
        pagination: {
            total,
            page,
            limit,
            totalPages: Math.ceil(total / limit) || 1,
        },
    };
}

export async function getDoctorById(id: string) {
    if (!mongoose.Types.ObjectId.isValid(id)) throw badRequest("Invalid doctor ID");

    const doctor = await DoctorProfile.findById(id)
        .populate({ path: "userId", select: "email isActive role createdAt" })
        .populate("specialization")
        .lean();

    if (!doctor) throw notFound("Doctor not found");

    const patientCount = await PatientModel.countDocuments({ doctors: doctor._id });

    return { ...doctor, patientCount };
}

export async function createDoctor(input: CreateDoctorInput) {
    // Check if email is already taken
    const existingUser = await UserModel.findOne({ email: input.email }).lean();
    if (existingUser) throw conflict("A user with this email already exists");

    const passwordHash = await argon2.hash(input.password);
    const user = await UserModel.create({
        name: input.name,
        email: input.email,
        passwordHash,
        role: "doctor",
        isActive: true,
    });

    const validSpecializations = input.specialization
        .filter((s) => mongoose.Types.ObjectId.isValid(s))
        .map((s) => new mongoose.Types.ObjectId(s));

    const profile = await DoctorProfile.create({
        userId: user._id,
        name: input.name,
        hospital: input.hospital,
        phone: input.phone || "",
        specialization: validSpecializations,
    });

    return {
        _id: profile._id,
        userId: user._id,
        name: profile.name,
        email: user.email,
        hospital: profile.hospital,
        phone: profile.phone,
        specialization: profile.specialization,
        isActive: user.isActive,
        createdAt: profile.createdAt,
    };
}

export async function updateDoctor(id: string, input: UpdateDoctorInput) {
    if (!mongoose.Types.ObjectId.isValid(id)) throw badRequest("Invalid doctor ID");

    const profile = await DoctorProfile.findById(id);
    if (!profile) throw notFound("Doctor not found");

    const user = await UserModel.findById(profile.userId);
    if (!user) throw notFound("Doctor user account not found");

    // Update email if provided and different
    if (input.email && input.email !== user.email) {
        const conflictUser = await UserModel.findOne({ email: input.email }).lean();
        if (conflictUser) throw conflict("Email is already in use by another account");
        user.email = input.email;
    }

    if (input.password) {
        user.passwordHash = await argon2.hash(input.password);
    }

    if (typeof input.isActive === "boolean") {
        user.isActive = input.isActive;
    }

    if (input.name) {
        user.name = input.name;
        profile.name = input.name;
    }

    if (input.hospital) {
        profile.hospital = input.hospital;
    }

    if (input.phone !== undefined) {
        profile.phone = input.phone;
    }

    if (input.specialization) {
        profile.specialization = input.specialization
            .filter((s) => mongoose.Types.ObjectId.isValid(s))
            .map((s) => new mongoose.Types.ObjectId(s));
    }

    await Promise.all([user.save(), profile.save()]);

    return {
        _id: profile._id,
        userId: user._id,
        name: profile.name,
        email: user.email,
        hospital: profile.hospital,
        phone: profile.phone,
        specialization: profile.specialization,
        isActive: user.isActive,
        updatedAt: profile.updatedAt,
    };
}

export async function deleteDoctor(id: string) {
    if (!mongoose.Types.ObjectId.isValid(id)) throw badRequest("Invalid doctor ID");

    const profile = await DoctorProfile.findById(id);
    if (!profile) throw notFound("Doctor not found");

    // Remove doctor from any patient doctor list
    await PatientModel.updateMany({ doctors: profile._id }, { $pull: { doctors: profile._id } });

    // Delete profile and user account
    await Promise.all([
        DoctorProfile.findByIdAndDelete(id),
        UserModel.findByIdAndDelete(profile.userId),
    ]);

    return { success: true, message: "Doctor deleted successfully" };
}

