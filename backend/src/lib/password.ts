import bcrypt from "bcryptjs";
import { env } from "../config/env.js";

// bcrypt has a hard 72-byte input limit; longer passwords are silently
// truncated. We reject them at validation time, but guard here too.
const MAX_PASSWORD_BYTES = 72;

export async function hashPassword(password: string): Promise<string> {
  if (Buffer.byteLength(password, "utf8") > MAX_PASSWORD_BYTES) {
    throw new Error("Password exceeds maximum length");
  }
  return bcrypt.hash(password, env.BCRYPT_ROUNDS);
}

export async function verifyPassword(
  password: string,
  hash: string,
): Promise<boolean> {
  return bcrypt.compare(password, hash);
}
