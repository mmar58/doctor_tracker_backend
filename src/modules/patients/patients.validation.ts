import { z } from "zod";

export const CreatePatientSchema = z.object({
    name: z.string().trim().min(2, "Name must be at least 2 characters").max(255),
    status: z.enum(["very-ill", "ill", "stable", "good"]).default("stable"),
    admit: z.boolean().default(false),
    gender: z.enum(["male", "female"]),
    age: z.coerce.number().int().min(0, "Age cannot be negative").max(120, "Age must be valid"),
    description: z.string().trim().min(2, "Description is required"),
    doctors: z.array(z.string()).optional().default([]),
});

export const UpdatePatientSchema = z.object({
    name: z.string().trim().min(2).max(255).optional(),
    status: z.enum(["very-ill", "ill", "stable", "good"]).optional(),
    admit: z.boolean().optional(),
    gender: z.enum(["male", "female"]).optional(),
    age: z.coerce.number().int().min(0).max(120).optional(),
    description: z.string().trim().min(2).optional(),
    doctors: z.array(z.string()).optional(),
});

export const QueryPatientsSchema = z.object({
    search: z.string().trim().optional(),
    status: z.enum(["very-ill", "ill", "stable", "good"]).optional(),
    admit: z
        .string()
        .optional()
        .transform((val) => (val === "true" ? true : val === "false" ? false : undefined)),
    gender: z.enum(["male", "female"]).optional(),
    doctorId: z.string().trim().optional(),
    page: z.coerce.number().int().min(1).default(1),
    limit: z.coerce.number().int().min(1).max(100).default(10),
});

export type CreatePatientInput = z.infer<typeof CreatePatientSchema>;
export type UpdatePatientInput = z.infer<typeof UpdatePatientSchema>;
export type QueryPatientsInput = z.infer<typeof QueryPatientsSchema>;

