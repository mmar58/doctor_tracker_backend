import mongoose from "mongoose";

export interface IDoctorProfile {
    userId: mongoose.Types.ObjectId,
    name: string,
    specialization: mongoose.Types.ObjectId[],
    hospital: string,
    phone: string
}


const doctorProfileSchema = new mongoose.Schema<IDoctorProfile>({
    userId: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
    name: { type: String, required: true, maxLength: 255 },
    specialization: [{ type: mongoose.Schema.Types.ObjectId, ref: "DoctorSpecialization" }],
    hospital: { type: String, required: true, maxLength: 255 },
    phone: { type: String, maxLength: 20, unique: true },
}, { timestamps: true }
)

export const DoctorProfile = mongoose.model<IDoctorProfile>("DoctorProfile", doctorProfileSchema)