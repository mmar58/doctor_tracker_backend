import { ZodType, z } from "zod";

export class HttpError extends Error {
    constructor(
        public status: number,
        message: string,
        public details?: unknown,
    ) {
        super(message);
    }
}

export const badRequest = (m = "Bad request", d?: unknown) => new HttpError(400, m, d);
export const unauthorized = (m = "Authentication required") => new HttpError(401, m);
export const forbidden = (m = "You do not have permission to do this") => new HttpError(403, m);
export const notFound = (m = "Not found") => new HttpError(404, m);
export const conflict = (m = "Conflict") => new HttpError(409, m);

// Parse and validate; throws a ZodError that the error handler turns into a 400.
export function parse<T extends ZodType>(schema: T, data: unknown): z.infer<T> {
    return schema.parse(data);
}

export function idParam(value: unknown): number {
    const n = Number(value);
    if (!Number.isInteger(n) || n <= 0) throw badRequest("Invalid id");
    return n;
}
