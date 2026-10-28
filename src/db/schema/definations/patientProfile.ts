import mongoose from "mongoose";

export interface IPatientProfile {
    _id?: mongoose.Types.ObjectId;
    name: string;
    status: "very-ill" | "ill" | "stable" | "good";
    admit: boolean;
    gender: "male" | "female";
    age: number;
    description: string;
    doctors: mongoose.Types.ObjectId[];
    createdAt?: Date;
    updatedAt?: Date;
}

const patientSchema = new mongoose.Schema<IPatientProfile>(
    {
        name: { type: String, required: true, maxLength: 255, trim: true },
        status: {
            type: String,
            enum: {
                values: ["very-ill", "ill", "stable", "good"],
                message: "{VALUE} is not a valid status",
            },
            required: true,
            default: "stable",
        },
        admit: { type: Boolean, default: false },
        gender: {
            type: String,
            enum: { values: ["male", "female"], message: "{VALUE} is not a valid gender" },
            required: true,
        },
        age: { type: Number, required: true, min: 0, max: 120 },
        description: { type: String, required: true, trim: true },
        doctors: [{ type: mongoose.Schema.Types.ObjectId, ref: "DoctorProfile" }],
    },
    { timestamps: true }
);

// Indexes for query performance and date-based aggregation
patientSchema.index({ doctors: 1 });
patientSchema.index({ createdAt: -1 });
patientSchema.index({ status: 1 });
patientSchema.index({ admit: 1 });

export const PatientModel = mongoose.model<IPatientProfile>("PatientProfile", patientSchema);
export const PatientProfileModel = PatientModel;
