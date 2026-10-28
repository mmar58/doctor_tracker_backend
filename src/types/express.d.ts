import "express-session";
// Extend Express session / request types
declare module "express-session" {
    interface SessionData {
        userId?: string;
    }
}

declare global {
    namespace Express {
        interface Request {
            user?: IUser & { _id: mongoose.Types.ObjectId };
        }
    }
}

export { };