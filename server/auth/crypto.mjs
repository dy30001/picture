import { randomBytes, scryptSync, timingSafeEqual } from "node:crypto";

function hashSecret(secret, label = "scrypt") {
  const salt = randomBytes(16).toString("hex");
  const hash = scryptSync(String(secret || ""), salt, 32).toString("hex");
  return `${label}:${salt}:${hash}`;
}

function verifySecret(secret, stored) {
  const [, salt, hash] = String(stored || "").split(":");
  if (!salt || !hash) return false;
  const expected = Buffer.from(hash, "hex");
  if (!expected.length) return false;
  const actual = scryptSync(String(secret || ""), salt, expected.length);
  return expected.length === actual.length && timingSafeEqual(expected, actual);
}

export function hashPassword(password) {
  return hashSecret(password, "scrypt");
}

export function verifyPassword(password, passwordHash) {
  return verifySecret(password, passwordHash);
}

export function hashVerificationCode(code) {
  return hashSecret(code, "code");
}

export function verifyVerificationCode(code, codeHash) {
  return verifySecret(code, codeHash);
}
