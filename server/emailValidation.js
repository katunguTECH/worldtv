const dns = require('dns').promises;
const fs = require('fs');
const path = require('path');

// Loaded once at startup. Refresh periodically with scripts/updateDisposableList.js.
const DISPOSABLE_LIST_PATH = path.join(__dirname, 'data', 'disposable-domains.json');

let disposableDomains = new Set();

function loadDisposableDomains() {
  try {
    const raw = fs.readFileSync(DISPOSABLE_LIST_PATH, 'utf-8');
    disposableDomains = new Set(JSON.parse(raw));
  } catch (err) {
    console.warn('[emailValidation] Could not load disposable domain list -- using fallback only. Run scripts/updateDisposableList.js.');
    disposableDomains = new Set();
  }
  for (const d of ['jioso.com', 'murkstar.com', 'mailinator.com', 'tempmail.com', '10minutemail.com', 'guerrillamail.com', 'yopmail.com']) {
    disposableDomains.add(d);
  }
}
loadDisposableDomains();

const EMAIL_REGEX = /^[a-zA-Z0-9.!#$%&'*+/=?^_`{|}~-]+@[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?(?:\.[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?)+$/;

function getDomain(email) {
  return String(email).trim().toLowerCase().split('@')[1];
}

function isValidSyntax(email) {
  if (typeof email !== 'string') return false;
  if (email.length > 254) return false;
  return EMAIL_REGEX.test(email.trim());
}

function isDisposableDomain(email) {
  return disposableDomains.has(getDomain(email));
}

async function hasMxRecord(email) {
  const domain = getDomain(email);
  if (!domain) return false;
  try {
    const records = await dns.resolveMx(domain);
    return Array.isArray(records) && records.length > 0;
  } catch {
    return false;
  }
}

async function validateEmailAddress(email) {
  if (!email || typeof email !== 'string') {
    return { valid: false, reason: 'missing_email' };
  }
  const trimmed = email.trim();

  if (!isValidSyntax(trimmed)) {
    return { valid: false, reason: 'invalid_syntax' };
  }
  if (isDisposableDomain(trimmed)) {
    return { valid: false, reason: 'disposable_domain' };
  }
  const hasMx = await hasMxRecord(trimmed);
  if (!hasMx) {
    return { valid: false, reason: 'no_mx_record' };
  }
  return { valid: true };
}

module.exports = { validateEmailAddress, isValidSyntax, isDisposableDomain, hasMxRecord, loadDisposableDomains };
