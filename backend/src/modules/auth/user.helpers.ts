import type { Prisma, User } from "@prisma/client";
import { prisma } from "../../lib/prisma.js";
import { randomToken } from "../../lib/crypto.js";

// Public-safe user projection (no relations / secrets).
export interface PublicUser {
  id: string;
  username: string;
  displayName: string;
  avatar: string | null;
  role: User["role"];
  createdAt: Date;
}

export function toPublicUser(user: User): PublicUser {
  return {
    id: user.id,
    username: user.username,
    displayName: user.displayName,
    avatar: user.avatar,
    role: user.role,
    createdAt: user.createdAt,
  };
}

function sanitizeBase(input: string): string {
  const cleaned = input
    .toLowerCase()
    .replace(/[^a-z0-9_]/g, "")
    .replace(/_+/g, "_")
    .replace(/^_|_$/g, "");
  return cleaned.slice(0, 24) || "user";
}

// Produce a unique username from a preferred base (email local-part / name),
// appending a short random suffix on collision. Accepts an optional tx client
// so it participates in the surrounding transaction.
export async function generateUniqueUsername(
  preferred: string,
  client: Prisma.TransactionClient = prisma,
): Promise<string> {
  const base = sanitizeBase(preferred);

  // Try the clean base first.
  const existing = await client.user.findUnique({ where: { username: base } });
  if (!existing) return base;

  for (let i = 0; i < 6; i++) {
    const suffix = randomToken(3).replace(/[^a-z0-9]/gi, "").slice(0, 5) || "1";
    const candidate = `${base}_${suffix}`.slice(0, 30);
    const clash = await client.user.findUnique({
      where: { username: candidate },
    });
    if (!clash) return candidate;
  }

  // Extremely unlikely fallback.
  return `${base}_${Date.now().toString(36)}`.slice(0, 30);
}
