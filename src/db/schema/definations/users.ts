import mongoose from "mongoose";

export interface IUser {
    email: string;
    passwordHash: string;
    name: string;
    isActive: boolean;
    // roles: embedded or ref array
    role: "admin" | "doctor";
}

const UserSchema = new mongoose.Schema<IUser>({
    email: { type: String, required: true, unique: true, maxLength: 255 },
    passwordHash: { type: String, required: true, maxLength: 255 },
    name: { type: String, required: true, maxLength: 100 },
    isActive: { type: Boolean, required: true, default: true },
    role: {
        type: String, enum: {
            values: ["admin", "doctor"],
            message: "{VALUE} is not a valid role",
        },
        default: "doctor",
        required: true,
    },
}, { timestamps: true }
);

export const UserModel = mongoose.model<IUser>("User", UserSchema);