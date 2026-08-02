import crypto from "node:crypto";
import { env } from "../config/env.js";

// AES-256-GCM authenticated encryption for provider tokens at rest.
// Serialized format: base64(iv).base64(authTag).base64(ciphertext)

const ALGORITHM = "aes-256-gcm";
const IV_LENGTH = 12; // 96-bit nonce, recommended for GCM

function loadKey(): Buffer {
  const raw = env.ENCRYPTION_KEY.trim();

  // Accept 64-char hex or base64. Must decode to exactly 32 bytes.
  let key: Buffer;
  if (/^[0-9a-fA-F]{64}$/.test(raw)) {
    key = Buffer.from(raw, "hex");
  } else {
    key = Buffer.from(raw, "base64");
  }

  if (key.length !== 32) {
    throw new Error(
      "ENCRYPTION_KEY must decode to 32 bytes (64 hex chars or base64 of 32 bytes)",
    );
  }
  return key;
}

const KEY = loadKey();

export function encrypt(plaintext: string): string {
  const iv = crypto.randomBytes(IV_LENGTH);
  const cipher = crypto.createCipheriv(ALGORITHM, KEY, iv);
  const ciphertext = Buffer.concat([
    cipher.update(plaintext, "utf8"),
    cipher.final(),
  ]);
  const authTag = cipher.getAuthTag();
  return [
    iv.toString("base64"),
    authTag.toString("base64"),
    ciphertext.toString("base64"),
  ].join(".");
}

export function decrypt(serialized: string): string {
  const parts = serialized.split(".");
  if (parts.length !== 3) {
    throw new Error("Invalid encrypted payload");
  }
  const [ivB64, tagB64, dataB64] = parts as [string, string, string];
  const iv = Buffer.from(ivB64, "base64");
  const authTag = Buffer.from(tagB64, "base64");
  const data = Buffer.from(dataB64, "base64");

  const decipher = crypto.createDecipheriv(ALGORITHM, KEY, iv);
  decipher.setAuthTag(authTag);
  return Buffer.concat([decipher.update(data), decipher.final()]).toString(
    "utf8",
  );
}

// Optional-value helpers for provider tokens that may be absent.
export function encryptNullable(value?: string | null): string | null {
  return value ? encrypt(value) : null;
}

export function decryptNullable(value?: string | null): string | null {
  return value ? decrypt(value) : null;
}

// --- Token / hashing primitives ---

// Generate a URL-safe random secret (default 48 bytes -> 64 base64url chars).
export function randomToken(bytes = 48): string {
  return crypto.randomBytes(bytes).toString("base64url");
}

// SHA-256 hex digest. Used to store refresh tokens as opaque hashes.
export function sha256(input: string): string {
  return crypto.createHash("sha256").update(input).digest("hex");
}

// Constant-time comparison of two hex/utf8 strings of equal length.
export function safeEqual(a: string, b: string): boolean {
  const bufA = Buffer.from(a);
  const bufB = Buffer.from(b);
  if (bufA.length !== bufB.length) return false;
  return crypto.timingSafeEqual(bufA, bufB);
}
