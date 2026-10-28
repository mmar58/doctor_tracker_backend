import { z } from "zod";

export const DashboardQuerySchema = z.object({
    days: z.coerce.number().int().min(1).max(365).default(30),
});

export type DashboardQueryInput = z.infer<typeof DashboardQuerySchema>;

