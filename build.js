#!/usr/bin/env node
// Encrypts a plaintext JSON payload into data.enc.json for the static site.
//
//   node build.js <input.json> <output.json>
//
// The passphrase is read from the PLAN_KEY environment variable and is never
// written to disk or committed. AES-256-GCM with a PBKDF2-SHA-256 derived key,
// fresh random salt and IV on every build.

const fs = require('node:fs');
const crypto = require('node:crypto');

const ITERATIONS = 250000;
const [, , inPath, outPath] = process.argv;
const pass = process.env.PLAN_KEY;

if (!inPath || !outPath) {
  console.error('usage: PLAN_KEY=<passphrase> node build.js <input.json> <output.json>');
  process.exit(1);
}
if (!pass) {
  console.error('PLAN_KEY is not set — refusing to build without a passphrase.');
  process.exit(1);
}

const plaintext = fs.readFileSync(inPath);
JSON.parse(plaintext); // fail loudly on malformed input rather than shipping it

const salt = crypto.randomBytes(16);
const iv = crypto.randomBytes(12);
const key = crypto.pbkdf2Sync(pass, salt, ITERATIONS, 32, 'sha256');

const cipher = crypto.createCipheriv('aes-256-gcm', key, iv);
const ct = Buffer.concat([cipher.update(plaintext), cipher.final()]);
const tag = cipher.getAuthTag();

fs.writeFileSync(outPath, JSON.stringify({
  v: 1,
  kdf: { name: 'PBKDF2', hash: 'SHA-256', iterations: ITERATIONS, salt: salt.toString('base64') },
  cipher: 'AES-GCM',
  iv: iv.toString('base64'),
  // WebCrypto expects the GCM tag appended to the ciphertext
  ct: Buffer.concat([ct, tag]).toString('base64')
}, null, 2) + '\n');

console.log(`encrypted ${plaintext.length} B -> ${outPath} (${ct.length + tag.length} B ciphertext)`);
