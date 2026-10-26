// Prints the SHA-256 hash of a passphrase for EDITOR_PASSPHRASE_SHA256 in src/config.js
import { createHash } from 'node:crypto';

const pass = process.argv[2];
if (!pass) {
  console.error('Usage: npm run hash-passphrase -- "your passphrase"');
  process.exit(1);
}
console.log(createHash('sha256').update(pass).digest('hex'));
