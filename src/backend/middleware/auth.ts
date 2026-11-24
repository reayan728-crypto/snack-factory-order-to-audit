import crypto from 'node:crypto';
import type { NextFunction, Request, Response } from 'express';
import { getDb } from '../db/connection.ts';

export type UserRole = 'salesman' | 'admin' | 'production' | 'accountant' | 'owner';

export interface AuthenticatedUser {
  id: number;
  email: string;
  name: string;
  role: UserRole;
}

export interface AuthRequest extends Request {
  authUser?: AuthenticatedUser;
}

const SESSION_SIGNING_KEY =
  process.env.SESSION_SECRET?.trim() || crypto.randomBytes(32).toString('hex');

export function hashUserPassword(password: string): string {
  const salt = crypto.randomBytes(16).toString('hex');
  const derived = crypto.scryptSync(password, salt, 32).toString('hex');
  return `${salt}:${derived}`;
}

export function verifyUserPassword(password: string, storedHash: string): boolean {
  if (!storedHash.includes(':')) return false;
  const [salt, expectedHex] = storedHash.split(':');
  const actualBuf = crypto.scryptSync(password, salt, 32);
  const expectedBuf = Buffer.from(expectedHex, 'hex');
  if (actualBuf.length !== expectedBuf.length) return false;
  return crypto.timingSafeEqual(actualBuf, expectedBuf);
}

export function issueSessionToken(user: AuthenticatedUser): string {
  const payloadObj = {
    sub: user.id,
    email: user.email,
    role: user.role,
    exp: Date.now() + 1000 * 60 * 60 * 12,
  };
  const payloadB64 = Buffer.from(JSON.stringify(payloadObj), 'utf8').toString('base64url');
  const sig = crypto
    .createHmac('sha256', SESSION_SIGNING_KEY)
    .update(payloadB64)
    .digest('base64url');
  return `${payloadB64}.${sig}`;
}

export function verifySessionToken(token: string): { sub: number; role: UserRole } | null {
  const parts = token.split('.');
  if (parts.length !== 2) return null;
  const [payloadB64, sig] = parts;
  const expectedSig = crypto
    .createHmac('sha256', SESSION_SIGNING_KEY)
    .update(payloadB64)
    .digest('base64url');

  const sigBuf = Buffer.from(sig);
  const expectedBuf = Buffer.from(expectedSig);
  if (sigBuf.length !== expectedBuf.length || !crypto.timingSafeEqual(sigBuf, expectedBuf)) {
    return null;
  }

  try {
    const parsed = JSON.parse(Buffer.from(payloadB64, 'base64url').toString('utf8')) as {
      sub: number;
      role: UserRole;
      exp: number;
    };
    if (!parsed.exp || Date.now() > parsed.exp) return null;
    return { sub: parsed.sub, role: parsed.role };
  } catch {
    return null;
  }
}

export function requireAuth(req: AuthRequest, res: Response, next: NextFunction): void {
  const header = req.headers.authorization;
  if (!header || !header.startsWith('Bearer ')) {
    res.status(401).json({ error: 'Unauthorized: Missing bearer token' });
    return;
  }

  const token = header.slice('Bearer '.length).trim();
  const decoded = verifySessionToken(token);
  if (!decoded) {
    res.status(401).json({ error: 'Unauthorized: Invalid or expired token' });
    return;
  }

  const db = getDb();
  const row = db
    .prepare('SELECT id, email, name, role, is_active FROM users WHERE id = ?')
    .get(decoded.sub) as
    | { id: number; email: string; name: string; role: UserRole; is_active: number }
    | undefined;

  if (!row || row.is_active !== 1) {
    res.status(401).json({ error: 'Unauthorized: Account inactive or missing' });
    return;
  }

  req.authUser = {
    id: row.id,
    email: row.email,
    name: row.name,
    role: row.role,
  };
  next();
}

export function requireRole(...allowedRoles: UserRole[]) {
  return (req: AuthRequest, res: Response, next: NextFunction): void => {
    if (!req.authUser) {
      res.status(401).json({ error: 'Unauthorized' });
      return;
    }
    if (!allowedRoles.includes(req.authUser.role)) {
      res.status(403).json({ error: 'Forbidden: Insufficient role permissions' });
      return;
    }
    next();
  };
}
