import * as argon2 from 'argon2';
import { createHash, randomBytes } from 'crypto';

export const SESSION_COOKIE = 'zwish_session';
export const SESSION_MS = 30 * 24 * 60 * 60 * 1000;

export function hashPassword(password: string): Promise<string> {
  return argon2.hash(password);
}

export function verifyPassword(hash: string, password: string): Promise<boolean> {
  return argon2.verify(hash, password);
}

export function newSessionToken(): { token: string; tokenHash: string } {
  const token = randomBytes(32).toString('base64url');
  const tokenHash = createHash('sha256').update(token).digest('hex');
  return { token, tokenHash };
}

export function hashSessionToken(token: string): string {
  return createHash('sha256').update(token).digest('hex');
}
