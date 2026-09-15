import { createHash, randomBytes } from "node:crypto";

// Paylaşım belirteci: 32 bayt rastgele (base64url, 43 karakter). Veritabanında yalnızca
// SHA-256 özeti tutulur; belirtecin kendisi oluşturulduğunda bir kez kullanıcıya gösterilir.
const TOKEN_PATTERN = /^[A-Za-z0-9_-]{43}$/;

export function hashShareToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

export function generateShareToken(): { token: string; hash: string } {
  const token = randomBytes(32).toString("base64url");
  return { token, hash: hashShareToken(token) };
}

export function isShareTokenFormat(token: string): boolean {
  return TOKEN_PATTERN.test(token);
}
