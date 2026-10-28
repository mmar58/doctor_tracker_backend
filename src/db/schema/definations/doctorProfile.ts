import mongoose from "mongoose";

export interface IDoctorProfile {
    _id?: mongoose.Types.ObjectId;
    userId: mongoose.Types.ObjectId;
    name: string;
    specialization: mongoose.Types.ObjectId[];
    hospital: string;
    phone: string;
    createdAt?: Date;
    updatedAt?: Date;
}

const doctorProfileSchema = new mongoose.Schema<IDoctorProfile>(
    {
        userId: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true, index: true },
        name: { type: String, required: true, maxLength: 255, trim: true },
        specialization: [{ type: mongoose.Schema.Types.ObjectId, ref: "DoctorSpecialization" }],
        hospital: { type: String, required: true, maxLength: 255, trim: true },
        phone: { type: String, maxLength: 20, default: "" },
    },
    { timestamps: true }
);

doctorProfileSchema.index({ hospital: 1 });
doctorProfileSchema.index({ createdAt: -1 });

export const DoctorProfile = mongoose.model<IDoctorProfile>("DoctorProfile", doctorProfileSchema);
export const DoctorProfileModel = DoctorProfile;
