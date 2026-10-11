import { randomBytes, scrypt as scryptCallback, timingSafeEqual } from "node:crypto";
import { promisify } from "node:util";

const scrypt = promisify(scryptCallback);
const KEY_LENGTH = 64;

export async function hashPassword(password) {
  const salt = randomBytes(16).toString("base64url");
  const hash = await scrypt(String(password), salt, KEY_LENGTH);
  return {
    passwordSalt: salt,
    passwordHash: Buffer.from(hash).toString("base64url")
  };
}

export async function verifyPassword(password, user) {
  if (!user) return false;

  if (user.passwordHash && user.passwordSalt) {
    const inputHash = await scrypt(String(password), user.passwordSalt, KEY_LENGTH);
    const storedHash = Buffer.from(user.passwordHash, "base64url");
    return storedHash.length === inputHash.length && timingSafeEqual(storedHash, inputHash);
  }

  if (user.devPassword) {
    return timingSafeEqualString(String(password), String(user.devPassword));
  }

  return false;
}

function timingSafeEqualString(a, b) {
  const left = Buffer.from(a);
  const right = Buffer.from(b);
  return left.length === right.length && timingSafeEqual(left, right);
}
