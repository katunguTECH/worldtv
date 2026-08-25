// ---------------------------------------------------------------------------
// IMPORTANT: This is a minimal file-based store so the endpoints work out of
// the box. It will NOT persist reliably on serverless hosts (Vercel, etc.)
// because the filesystem is ephemeral/read-only in production there.
//
// You already have a database backing the admin dashboard's "Emails" tab —
// swap the four functions below to read/write that same table/collection
// (add a `confirmed` boolean and a `token` column/field to it) and everything
// else in this feature works unchanged.
// ---------------------------------------------------------------------------

import fs from 'fs';
import path from 'path';
import crypto from 'crypto';

export interface EmailRecord {
  email: string;
  token: string;
  confirmed: boolean;
  createdAt: string;
  confirmedAt?: string;
}

const DB_PATH = path.join(process.cwd(), '.data', 'emails.json');
const TOKEN_TTL_MS = 24 * 60 * 60 * 1000; // 24 hours

function readAll(): EmailRecord[] {
  try {
    if (!fs.existsSync(DB_PATH)) return [];
    return JSON.parse(fs.readFileSync(DB_PATH, 'utf-8'));
  } catch {
    return [];
  }
}

function writeAll(records: EmailRecord[]) {
  fs.mkdirSync(path.dirname(DB_PATH), { recursive: true });
  fs.writeFileSync(DB_PATH, JSON.stringify(records, null, 2));
}

export function createPendingEmail(email: string): EmailRecord {
  const records = readAll();
  const token = crypto.randomBytes(24).toString('hex');
  const record: EmailRecord = {
    email: email.toLowerCase().trim(),
    token,
    confirmed: false,
    createdAt: new Date().toISOString(),
  };
  // replace any prior pending record for the same email
  const filtered = records.filter((r) => r.email !== record.email);
  filtered.push(record);
  writeAll(filtered);
  return record;
}

export function confirmByToken(token: string): EmailRecord | null {
  const records = readAll();
  const idx = records.findIndex((r) => r.token === token);
  if (idx === -1) return null;

  const record = records[idx];
  const age = Date.now() - new Date(record.createdAt).getTime();
  if (age > TOKEN_TTL_MS) return null; // expired

  record.confirmed = true;
  record.confirmedAt = new Date().toISOString();
  records[idx] = record;
  writeAll(records);
  return record;
}
