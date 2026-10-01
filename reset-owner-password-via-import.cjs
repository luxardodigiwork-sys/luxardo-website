'use strict';
/* ===========================================================================
 * reset-owner-password-via-import.cjs
 *
 * One-time password reset for a SINGLE existing Firebase Auth user, using the
 * Firebase CLI's existing `firebase login` session (firebase auth:import).
 * No gcloud, no service-account key, no ADC.
 *
 *   PROJECT (hard-coded, asserted) : luxardo-flow
 *   USER    (hard-coded, asserted) : owner@luxardofashion.com
 *   Refuses to run against         : luxardo-fashion-website
 *
 * WHAT IT DOES
 *   1. firebase auth:export  (read-only)  -> locate the exact user record.
 *   2. Show an identity summary; require you to type "yes".
 *   3. Prompt for the new password TWICE with hidden input (raw mode, no echo).
 *   4. bcrypt-hash the password locally (bcryptjs, cost 12).
 *   5. Build a ONE-user import file = the exact exported record with ONLY
 *      `passwordHash` replaced (BCRYPT, base64) and the scrypt `salt` removed.
 *      Every other field (localId, email, emailVerified, disabled, displayName,
 *      providerUserInfo, customAttributes, createdAt, lastSignedInAt) is copied
 *      byte-for-byte.
 *   6. firebase auth:import <file> --hash-algo=BCRYPT --project luxardo-flow
 *   7. Delete the temp file/dir immediately (also in a finally{}).
 *   8. firebase auth:export again (read-only) and verify:
 *        same localId, same email, same disabled, same emailVerified,
 *        same customAttributes, same providerUserInfo, same displayName,
 *        passwordHash fingerprint CHANGED.
 *
 * SAFETY
 *   - Plaintext password is never printed, logged, or written to disk.
 *   - Only a bcrypt HASH goes into the temp file; temp dir is 0700 and is
 *     unlinked right after import (and again in finally{}).
 *   - No user is created (auth:import upserts by localId; localId preserved).
 *   - Other 9 users are not in the file, so they are untouched.
 *   - Nothing is deployed. No Firestore write. No source/config file changed.
 *
 * RUN
 *   node reset-owner-password-via-import.cjs             # DRY RUN (default) - builds
 *                                                        #   everything, changes NOTHING
 *   node reset-owner-password-via-import.cjs --commit    # actually import
 *
 * Run from the repo root (so `require('bcryptjs')` and `npx firebase` resolve):
 *   cd C:\Users\user\Desktop\luxardo-website
 *   node <path>\reset-owner-password-via-import.cjs [--commit]
 * =========================================================================== */

const fs = require('fs');
const os = require('os');
const path = require('path');
const crypto = require('crypto');
const readline = require('readline');
const { execSync } = require('child_process');

const PROJECT = 'luxardo-flow';
const EMAIL = 'owner@luxardofashion.com';
const FORBIDDEN_PROJECT = 'luxardo-fashion-website';
const BCRYPT_COST = 12;
const COMMIT = process.argv.includes('--commit');

if (PROJECT === FORBIDDEN_PROJECT) { console.error('ABORT: project guard.'); process.exit(2); }

let bcrypt;
try { bcrypt = require('bcryptjs'); }
catch (e) { console.error('ABORT: bcryptjs not found. Run from the repo root, or `npm i bcryptjs`.'); process.exit(2); }

const fp = (s) => (s ? crypto.createHash('sha256').update(String(s)).digest('hex').slice(0, 12) : null);

function fb(args) {
  // Always pins --project luxardo-flow. Uses the CLI's existing `firebase login`.
  // Runs via the default shell so `npx` resolves on Windows (npx.cmd) and POSIX.
  // Every arg is a controlled constant or a mkdtemp() temp path (no user input),
  // and each is double-quoted, so there is no injection surface.
  const full = ['firebase', ...args, '--project', PROJECT];
  const cmd = 'npx ' + full.map((a) => JSON.stringify(String(a))).join(' ');
  return execSync(cmd, {
    encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'], maxBuffer: 64 * 1024 * 1024,
  });
}

function promptLine(q) {
  return new Promise((res) => {
    const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
    rl.question(q, (v) => { rl.close(); res((v || '').trim()); });
  });
}

function promptHidden(q) {
  return new Promise((res) => {
    const stdin = process.stdin;
    process.stdout.write(q);
    stdin.resume();
    if (stdin.setRawMode) stdin.setRawMode(true);
    let buf = '';
    const done = (val, code) => {
      if (stdin.setRawMode) stdin.setRawMode(false);
      stdin.pause();
      stdin.removeListener('data', onData);
      process.stdout.write('\n');
      if (typeof code === 'number') process.exit(code);
      res(val);
    };
    const onData = (chunk) => {
      for (let i = 0; i < chunk.length; i++) {
        const c = chunk[i];
        if (c === 0x0d || c === 0x0a || c === 0x04) return done(buf);          // CR/LF/Ctrl-D
        if (c === 0x03) return done(null, 130);                               // Ctrl-C
        if (c === 0x7f || c === 0x08) { buf = buf.slice(0, -1); continue; }   // backspace
        if (c >= 0x20) buf += String.fromCharCode(c);
      }
    };
    stdin.on('data', onData);
  });
}

(async () => {
  console.log(`Mode            : ${COMMIT ? 'COMMIT (will import)' : 'DRY RUN (no changes; pass --commit to import)'}`);
  console.log(`Project         : ${PROJECT}`);
  console.log(`Target user     : ${EMAIL}`);

  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'lf-pwd-'));
  try { fs.chmodSync(tmpDir, 0o700); } catch (_) {}
  const exportPath = path.join(tmpDir, 'export.json');
  const importPath = path.join(tmpDir, 'import.json');
  const verifyPath = path.join(tmpDir, 'verify.json');

  const cleanup = () => { try { fs.rmSync(tmpDir, { recursive: true, force: true }); } catch (_) {} };

  try {
    // ---- 1. read-only export ----
    fb(['auth:export', exportPath, '--format=json']);
    const exp = JSON.parse(fs.readFileSync(exportPath, 'utf8'));
    const matches = (exp.users || []).filter((u) => (u.email || '').toLowerCase() === EMAIL);
    if (matches.length === 0) { console.error(`ABORT: ${EMAIL} not found in ${PROJECT}.`); cleanup(); process.exit(3); }
    if (matches.length > 1) { console.error(`ABORT: ${matches.length} accounts share ${EMAIL}. Refusing to guess.`); cleanup(); process.exit(3); }
    const user = matches[0];
    if ((user.email || '').toLowerCase() !== EMAIL) { console.error('ABORT: email mismatch.'); cleanup(); process.exit(3); }
    if (!user.localId) { console.error('ABORT: no localId on record.'); cleanup(); process.exit(3); }

    // ---- 2. identity summary + confirm ----
    console.log('\n--- Existing user (everything below is PRESERVED) ---');
    console.log(JSON.stringify({
      localId: user.localId,
      email: user.email,
      emailVerified: !!user.emailVerified,
      disabled: !!user.disabled,
      displayName: user.displayName ?? null,
      providerUserInfo: user.providerUserInfo ?? [],
      customAttributes: user.customAttributes ?? null,   // custom claims
      createdAt: user.createdAt ?? null,
      lastSignedInAt: user.lastSignedInAt ?? null,
      passwordHash_fingerprint: fp(user.passwordHash),
      salt_present: !!user.salt,
      otherFieldKeys: Object.keys(user).filter((k) => ![
        'localId','email','emailVerified','disabled','displayName','providerUserInfo',
        'customAttributes','createdAt','lastSignedInAt','passwordHash','salt',
      ].includes(k)),
    }, null, 2));
    console.log('\n--- Change: passwordHash ONLY (algo SCRYPT -> BCRYPT); scrypt `salt` removed. Nothing else. ---');

    const go = await promptLine(`\nProceed for localId ${user.localId} (${EMAIL}) in ${PROJECT}? type "yes": `);
    if (go !== 'yes') { console.log('Cancelled. No changes made.'); cleanup(); process.exit(0); }

    // ---- 3. hidden password ----
    let pw1 = await promptHidden('New password (hidden)        : ');
    let pw2 = await promptHidden('Confirm new password (hidden) : ');
    const blen = Buffer.byteLength(pw1 || '', 'utf8');
    if (!pw1 || blen < 6) { pw1 = pw2 = null; console.error('ABORT: password must be >= 6 bytes.'); cleanup(); process.exit(4); }
    if (blen > 72) { pw1 = pw2 = null; console.error('ABORT: password > 72 bytes (bcrypt limit). Use <= 72.'); cleanup(); process.exit(4); }
    if (pw1 !== pw2) { pw1 = pw2 = null; console.error('ABORT: passwords did not match.'); cleanup(); process.exit(4); }

    // ---- 4. bcrypt locally ----
    const bcryptHash = bcrypt.hashSync(pw1, BCRYPT_COST);          // "$2b$12$...."
    pw1 = null; pw2 = null;
    const passwordHashB64 = Buffer.from(bcryptHash, 'utf8').toString('base64');

    // ---- 5. build the one-user record: exact copy, swap passwordHash, drop salt ----
    const record = JSON.parse(JSON.stringify(user));
    delete record.salt;                       // scrypt salt is invalid for bcrypt
    record.passwordHash = passwordHashB64;
    const payload = { users: [record] };
    fs.writeFileSync(importPath, JSON.stringify(payload, null, 2), { mode: 0o600 });

    const preservedKeys = Object.keys(record).filter((k) => k !== 'passwordHash').sort();
    console.log('\n--- Import file built (temp, 1 user) ---');
    console.log(JSON.stringify({
      users: 1,
      localId: record.localId,
      passwordHash_algo: 'BCRYPT',
      passwordHash_fingerprint_new: fp(passwordHashB64),
      salt_removed: !('salt' in record),
      preserved_fields: preservedKeys,
    }, null, 2));

    if (!COMMIT) {
      console.log('\nDRY RUN complete. Nothing was imported. Re-run with --commit to apply.');
      cleanup();
      process.exit(0);
    }

    // ---- 6. import (COMMIT only) ----
    console.log('\nRunning: firebase auth:import <tmp> --hash-algo=BCRYPT --project ' + PROJECT);
    const out = fb(['auth:import', importPath, '--hash-algo', 'BCRYPT']);
    process.stdout.write(out.endsWith('\n') ? out : out + '\n');

    // ---- 7. delete temp import file immediately ----
    try { fs.unlinkSync(importPath); } catch (_) {}

    // ---- 8. read-only verification ----
    fb(['auth:export', verifyPath, '--format=json']);
    const ver = JSON.parse(fs.readFileSync(verifyPath, 'utf8'));
    const after = (ver.users || []).find((u) => u.localId === user.localId);
    if (!after) { console.error('VERIFY FAIL: user not found after import.'); cleanup(); process.exit(5); }

    const checks = {
      same_localId: after.localId === user.localId,
      same_email: (after.email || '') === (user.email || ''),
      same_disabled: !!after.disabled === !!user.disabled,
      same_emailVerified: !!after.emailVerified === !!user.emailVerified,
      same_customAttributes: JSON.stringify(after.customAttributes ?? null) === JSON.stringify(user.customAttributes ?? null),
      same_providerUserInfo: JSON.stringify(after.providerUserInfo ?? []) === JSON.stringify(user.providerUserInfo ?? []),
      same_displayName: (after.displayName ?? null) === (user.displayName ?? null),
      same_createdAt: (after.createdAt ?? null) === (user.createdAt ?? null),
      passwordHash_changed: fp(after.passwordHash) !== fp(user.passwordHash),
      total_user_count_unchanged: (ver.users || []).length === (exp.users || []).length,
    };
    console.log('\n--- Verification (read-only auth:export) ---');
    console.log(JSON.stringify({
      localId: after.localId,
      email: after.email,
      passwordHash_fingerprint_before: fp(user.passwordHash),
      passwordHash_fingerprint_after: fp(after.passwordHash),
      checks,
    }, null, 2));

    const ok = Object.values(checks).every(Boolean);
    console.log(ok
      ? `\nPASS: password changed for ${EMAIL}; localId/email/disabled/claims/providers/displayName all preserved.`
      : `\nFAIL: review the checks above.`);
    cleanup();
    process.exit(ok ? 0 : 5);
  } catch (e) {
    console.error('ERROR:', (e && (e.stderr || e.message || e)).toString().trim());
    cleanup();
    process.exit(1);
  } finally {
    cleanup();
  }
})();
