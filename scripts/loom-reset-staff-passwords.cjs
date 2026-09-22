'use strict';
/* ===========================================================================
 * loom-reset-staff-passwords.cjs
 *
 * TEMPORARY dev/setup helper for LUXARDO FLOW (Firebase project: luxardo-flow).
 * Sets the Firebase Authentication password of EVERY non-Super-Admin staff
 * account to a single known value (USER123456) so the login flow can be
 * exercised for every role. Uses the Firebase CLI's existing `firebase login`
 * session via `firebase auth:import` — no service-account key, no gcloud, no ADC.
 *
 *   PROJECT (hard-coded, asserted) : luxardo-flow
 *   Refuses to run against         : luxardo-fashion-website
 *   NEW PASSWORD                    : USER123456
 *
 * TARGETS (8) — the known non-Super-Admin staff identifiers:
 *   owner, pm, designer, dispatch, guard, grade, tailor, store  @luxardofashion.com
 *
 * NEVER TOUCHED:
 *   - luxardodigiwork@gmail.com  (Super Admin — real Gmail; Google + password + reset)
 *   - abhijeetra799@gmail.com    (Admin — real Gmail; Google + password + reset)
 *   - any account not in TARGET_EMAILS (absent from the import file)
 *
 * WHAT IT DOES
 *   1. firebase auth:export  (read-only)  -> locate the exact user records.
 *   2. Show an identity summary for the 8 targets; require you to type "yes".
 *   3. bcrypt-hash USER123456 locally (bcryptjs, cost 12) once per user.
 *   4. Build an import file = each exported record with ONLY `passwordHash`
 *      replaced (BCRYPT, base64) and the scrypt `salt` removed. Every other
 *      field (localId, email, emailVerified, disabled, displayName,
 *      providerUserInfo, customAttributes, createdAt, ...) is copied verbatim.
 *   5. firebase auth:import <file> --hash-algo=BCRYPT --project luxardo-flow
 *   6. Delete the temp dir immediately (also in finally{}).
 *   7. firebase auth:export again (read-only) and verify per user:
 *        same localId / email / disabled / emailVerified / customAttributes /
 *        providerUserInfo / displayName ; passwordHash fingerprint CHANGED ;
 *        total account count unchanged.
 *
 * SAFETY
 *   - auth:import upserts by localId (which is preserved) — NO user is created,
 *     renamed, or deleted. Non-target users are not in the file -> untouched.
 *   - Plaintext password is never written to disk; only a bcrypt HASH is.
 *   - Temp dir is 0700 and unlinked right after import (and again in finally{}).
 *   - Nothing is deployed. No Firestore write. No source/config file changed.
 *
 * RUN  (from the repo root, so `require('bcryptjs')` and `npx firebase` resolve)
 *   node scripts/loom-reset-staff-passwords.cjs            # DRY RUN (default)
 *   node scripts/loom-reset-staff-passwords.cjs --commit   # actually import
 * =========================================================================== */

const fs = require('fs');
const os = require('os');
const path = require('path');
const crypto = require('crypto');
const readline = require('readline');
const { execSync } = require('child_process');

const PROJECT = 'luxardo-flow';
const FORBIDDEN_PROJECT = 'luxardo-fashion-website';
const NEW_PASSWORD = 'USER123456';
const BCRYPT_COST = 12;
const COMMIT = process.argv.includes('--commit');

const TARGET_EMAILS = [
  'owner@luxardofashion.com',
  'pm@luxardofashion.com',
  'designer@luxardofashion.com',
  'dispatch@luxardofashion.com',
  'guard@luxardofashion.com',
  'grade@luxardofashion.com',
  'tailor@luxardofashion.com',
  'store@luxardofashion.com',
].map((e) => e.toLowerCase());

// The two PRIVILEGED Gmail accounts — real mailboxes that keep Google Sign-In,
// email/password AND genuine Firebase password reset. They must NEVER be given
// the shared USER123456 password. Belt-and-braces: even if one is ever added to
// TARGET_EMAILS, refuse it.
const EXCLUDE_EMAILS = [
  'luxardodigiwork@gmail.com', // Super Admin
  'abhijeetra799@gmail.com',   // Admin
].map((e) => e.toLowerCase());

if (PROJECT === FORBIDDEN_PROJECT) { console.error('ABORT: project guard.'); process.exit(2); }

let bcrypt;
try { bcrypt = require('bcryptjs'); }
catch (e) { console.error('ABORT: bcryptjs not found. Run from the repo root, or `npm i bcryptjs`.'); process.exit(2); }

const fp = (s) => (s ? crypto.createHash('sha256').update(String(s)).digest('hex').slice(0, 12) : null);

function fb(args) {
  const full = ['firebase', ...args, '--project', PROJECT];
  const cmd = 'npx ' + full.map((a) => JSON.stringify(String(a))).join(' ');
  return execSync(cmd, {
    encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'], maxBuffer: 128 * 1024 * 1024,
  });
}

function promptLine(q) {
  return new Promise((res) => {
    const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
    rl.question(q, (v) => { rl.close(); res((v || '').trim()); });
  });
}

(async () => {
  console.log(`Mode         : ${COMMIT ? 'COMMIT (will import)' : 'DRY RUN (no changes; pass --commit to import)'}`);
  console.log(`Project      : ${PROJECT}`);
  console.log(`New password : ${NEW_PASSWORD}`);
  console.log(`Targets      : ${TARGET_EMAILS.length} accounts`);

  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'lf-staff-pwd-'));
  try { fs.chmodSync(tmpDir, 0o700); } catch (_) {}
  const exportPath = path.join(tmpDir, 'export.json');
  const importPath = path.join(tmpDir, 'import.json');
  const verifyPath = path.join(tmpDir, 'verify.json');
  const cleanup = () => { try { fs.rmSync(tmpDir, { recursive: true, force: true }); } catch (_) {} };

  try {
    // ---- 1. read-only export ----
    fb(['auth:export', exportPath, '--format=json']);
    const exp = JSON.parse(fs.readFileSync(exportPath, 'utf8'));
    const all = exp.users || [];
    const byEmail = new Map(all.map((u) => [(u.email || '').toLowerCase(), u]));

    // ---- 2. resolve + validate targets ----
    const picked = [];
    const missing = [];
    for (const email of TARGET_EMAILS) {
      if (EXCLUDE_EMAILS.includes(email)) { console.error(`ABORT: ${email} is on the exclude list.`); cleanup(); process.exit(3); }
      const u = byEmail.get(email);
      if (!u) { missing.push(email); continue; }
      if (!u.localId) { console.error(`ABORT: ${email} has no localId.`); cleanup(); process.exit(3); }
      picked.push(u);
    }
    if (missing.length) {
      console.error(`ABORT: ${missing.length} target account(s) not found in ${PROJECT}:`);
      for (const m of missing) console.error(`  - ${m}`);
      cleanup(); process.exit(3);
    }

    console.log('\n--- Targets (everything below is PRESERVED; only passwordHash changes) ---');
    for (const u of picked) {
      const providers = (u.providerUserInfo || []).map((p) => p.providerId);
      const federatedOnly = !u.passwordHash && providers.length > 0;
      console.log(JSON.stringify({
        email: u.email,
        localId: u.localId,
        disabled: !!u.disabled,
        emailVerified: !!u.emailVerified,
        providers,
        passwordHash_fingerprint: fp(u.passwordHash),
        note: federatedOnly ? 'WARNING: federated-only account (will gain a password)' : undefined,
      }));
    }

    const go = await promptLine(`\nSet password to "${NEW_PASSWORD}" for these ${picked.length} accounts in ${PROJECT}? type "yes": `);
    if (go !== 'yes') { console.log('Cancelled. No changes made.'); cleanup(); process.exit(0); }

    // ---- 3./4. build import records (bcrypt per user) ----
    const records = picked.map((u) => {
      const rec = JSON.parse(JSON.stringify(u));
      delete rec.salt; // scrypt salt is invalid for bcrypt
      rec.passwordHash = Buffer.from(bcrypt.hashSync(NEW_PASSWORD, BCRYPT_COST), 'utf8').toString('base64');
      return rec;
    });
    fs.writeFileSync(importPath, JSON.stringify({ users: records }, null, 2), { mode: 0o600 });

    console.log('\n--- Import file built (temp) ---');
    console.log(JSON.stringify({
      users: records.length,
      hash_algo: 'BCRYPT',
      per_user: records.map((r) => ({ localId: r.localId, email: r.email, newHash_fp: fp(r.passwordHash), salt_removed: !('salt' in r) })),
    }, null, 2));

    if (!COMMIT) {
      console.log('\nDRY RUN complete. Nothing was imported. Re-run with --commit to apply.');
      cleanup();
      process.exit(0);
    }

    // ---- 5. import ----
    console.log('\nRunning: firebase auth:import <tmp> --hash-algo=BCRYPT --project ' + PROJECT);
    const out = fb(['auth:import', importPath, '--hash-algo', 'BCRYPT']);
    process.stdout.write(out.endsWith('\n') ? out : out + '\n');

    // ---- 6. delete temp import file immediately ----
    try { fs.unlinkSync(importPath); } catch (_) {}

    // ---- 7. read-only verification ----
    fb(['auth:export', verifyPath, '--format=json']);
    const ver = JSON.parse(fs.readFileSync(verifyPath, 'utf8'));
    const afterById = new Map((ver.users || []).map((u) => [u.localId, u]));

    let allOk = true;
    console.log('\n--- Verification (read-only auth:export) ---');
    for (const before of picked) {
      const after = afterById.get(before.localId);
      const checks = after ? {
        same_localId: after.localId === before.localId,
        same_email: (after.email || '') === (before.email || ''),
        same_disabled: !!after.disabled === !!before.disabled,
        same_emailVerified: !!after.emailVerified === !!before.emailVerified,
        same_customAttributes: JSON.stringify(after.customAttributes ?? null) === JSON.stringify(before.customAttributes ?? null),
        same_providerUserInfo: JSON.stringify(after.providerUserInfo ?? []) === JSON.stringify(before.providerUserInfo ?? []),
        same_displayName: (after.displayName ?? null) === (before.displayName ?? null),
        passwordHash_changed: fp(after.passwordHash) !== fp(before.passwordHash),
      } : { found: false };
      const ok = after && Object.values(checks).every(Boolean);
      allOk = allOk && ok;
      console.log(JSON.stringify({ email: before.email, localId: before.localId, ok, checks }));
    }
    const countOk = (ver.users || []).length === all.length;
    console.log(`\ntotal_user_count_unchanged: ${countOk} (${all.length} -> ${(ver.users || []).length})`);

    const pass = allOk && countOk;
    console.log(pass
      ? `\nPASS: password set to "${NEW_PASSWORD}" for ${picked.length} accounts; identity fields preserved; no users added/removed.`
      : `\nFAIL: review the checks above.`);
    cleanup();
    process.exit(pass ? 0 : 5);
  } catch (e) {
    console.error('ERROR:', (e && (e.stderr || e.message || e)).toString().trim());
    cleanup();
    process.exit(1);
  } finally {
    cleanup();
  }
})();
