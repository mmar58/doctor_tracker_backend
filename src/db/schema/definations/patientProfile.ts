import mongoose from "mongoose"

export interface IPatientProfile {
    name: string,
    status: "very-ill" | "ill" | "stable" | "good",
    admit: boolean,
    gender: "male" | "female",
    age: number,
    description: string
    doctors: mongoose.Types.ObjectId[]
}

const patientSchema = new mongoose.Schema<IPatientProfile>({
    name: { type: String, required: true, maxLength: 255 },
    status: {
        type: String, enum: {
            values: ["very-ill", "ill", "stable", "good"],
            message: "{VALUE} is not a valid status",
        }
    },
    admit: { type: Boolean, default: true },
    gender: { type: String, enum: { values: ["male", "female"], message: "{VALUE} is not a valid gender" } },
    age: { type: Number, required: true, min: 0, max: 120 },
    description: { type: String, required: true, trim: true },
    doctors: [{ type: mongoose.Schema.Types.ObjectId, ref: "DoctorProfile" }]

})