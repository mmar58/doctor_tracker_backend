import { z } from "zod";

export const CreateDoctorSchema = z.object({
    name: z.string().trim().min(2, "Name must be at least 2 characters").max(100),
    email: z.string().trim().email("Invalid email address").max(255),
    password: z.string().min(8, "Password must be at least 8 characters").max(72),
    hospital: z.string().trim().min(2, "Hospital name is required").max(255),
    phone: z.string().trim().max(20).optional().default(""),
    specialization: z.array(z.string()).optional().default([]),
});

export const UpdateDoctorSchema = z.object({
    name: z.string().trim().min(2).max(100).optional(),
    email: z.string().trim().email().max(255).optional(),
    password: z.string().min(8).max(72).optional(),
    hospital: z.string().trim().min(2).max(255).optional(),
    phone: z.string().trim().max(20).optional(),
    specialization: z.array(z.string()).optional(),
    isActive: z.boolean().optional(),
});

export const QueryDoctorsSchema = z.object({
    search: z.string().trim().optional(),
    page: z.coerce.number().int().min(1).default(1),
    limit: z.coerce.number().int().min(1).max(100).default(10),
});

export type CreateDoctorInput = z.infer<typeof CreateDoctorSchema>;
export type UpdateDoctorInput = z.infer<typeof UpdateDoctorSchema>;
export type QueryDoctorsInput = z.infer<typeof QueryDoctorsSchema>;

