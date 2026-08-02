import type { UserRole } from "@prisma/client";

// The authenticated principal attached by the `authenticate` middleware.
export interface AuthContext {
  userId: string;
  sessionId: string;
  role: UserRole;
  tokenVersion: number;
}

declare global {
  namespace Express {
    interface Request {
      auth?: AuthContext;
    }
  }
}

export {};
