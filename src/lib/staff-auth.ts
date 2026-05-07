import { createHash, randomBytes, createHmac } from 'crypto';
import { cookies } from 'next/headers';
import { supabase } from './supabase';
import type { StaffSession, Permission } from './permissions';

const STAFF_COOKIE = 'staff_session';
const SECRET = process.env.STAFF_SESSION_SECRET ?? 'yp-staff-dev-secret';

// ─── Password ────────────────────────────────────────────────────────────────

export function generateSalt(): string {
  return randomBytes(16).toString('hex');
}

export function hashPassword(password: string, salt: string): string {
  return createHash('sha256').update(`${salt}:${password}:${SECRET}`).digest('hex');
}

export function generateTempPassword(): string {
  return randomBytes(6).toString('hex'); // 12-char hex string
}

// ─── Token ───────────────────────────────────────────────────────────────────

function signToken(staffId: string): string {
  const payload = `${staffId}|${Date.now()}`;
  const sig = createHmac('sha256', SECRET).update(payload).digest('hex');
  return Buffer.from(`${payload}|${sig}`).toString('base64url');
}

function verifyToken(token: string): string | null {
  try {
    const decoded = Buffer.from(token, 'base64url').toString();
    const lastPipe = decoded.lastIndexOf('|');
    if (lastPipe === -1) return null;
    const payload = decoded.slice(0, lastPipe);
    const sig = decoded.slice(lastPipe + 1);
    const expected = createHmac('sha256', SECRET).update(payload).digest('hex');
    if (sig !== expected) return null;
    const [staffId, ts] = payload.split('|');
    // 10-hour expiry
    if (Date.now() - Number(ts) > 10 * 60 * 60 * 1000) return null;
    return staffId;
  } catch {
    return null;
  }
}

// ─── Cookie ──────────────────────────────────────────────────────────────────

export async function setStaffCookie(staffId: string): Promise<void> {
  const store = await cookies();
  store.set(STAFF_COOKIE, signToken(staffId), {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    maxAge: 60 * 60 * 10,
    path: '/',
    sameSite: 'lax',
  });
}

export async function clearStaffCookie(): Promise<void> {
  const store = await cookies();
  store.delete(STAFF_COOKIE);
}

// ─── Session ─────────────────────────────────────────────────────────────────

export async function getStaffSession(): Promise<StaffSession | null> {
  const store = await cookies();

  // Check owner session first (existing password-based auth)
  const adminCookie = store.get('admin_session')?.value;
  const adminPass = process.env.ADMIN_PASSWORD;
  if (adminPass && adminCookie === Buffer.from(adminPass).toString('base64')) {
    return { id: 'owner', email: 'owner', name: 'Owner', permissions: [], isOwner: true };
  }

  // Check staff session
  const token = store.get(STAFF_COOKIE)?.value;
  if (!token) return null;
  const staffId = verifyToken(token);
  if (!staffId) return null;

  const { data } = await supabase
    .from('staff_members')
    .select('id, email, name, permissions, is_active')
    .eq('id', staffId)
    .eq('is_active', true)
    .single();

  if (!data) return null;
  return {
    id: data.id,
    email: data.email,
    name: data.name,
    permissions: (data.permissions as Permission[]) ?? [],
    isOwner: false,
  };
}
