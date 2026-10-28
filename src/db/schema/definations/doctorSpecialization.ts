import mongoose from "mongoose"

export interface IDoctorSpecialization {
    name: string
}

const doctorSpecializationSchema = new mongoose.Schema<IDoctorSpecialization>({
    name: { type: String, required: true, unique: true, maxLength: 100 }
})


export const DoctorSpecializationModel = mongoose.model<IDoctorSpecialization>("DoctorSpecialization", doctorSpecializationSchema)

