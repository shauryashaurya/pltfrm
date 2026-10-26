// Editor access: a passphrase unlocks editing for this browser tab.
// This is a deterrent on a static site, not security: the data ships to every visitor.
import { EDITOR_PASSPHRASE_SHA256 } from '../config.js';
import { storageGet, storageSet } from './state.js';

const KEY = 'playbookEditor';

export function isEditor() { return storageGet(sessionStorage, KEY) === '1'; }

// Hash the typed passphrase and compare with the configured hash
export async function unlock(passphrase) {
  if (!crypto?.subtle) throw new Error('Editing needs a secure page (https or localhost).');
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(passphrase));
  const hex = [...new Uint8Array(digest)].map(b => b.toString(16).padStart(2, '0')).join('');
  const ok = hex === EDITOR_PASSPHRASE_SHA256;
  if (ok) storageSet(sessionStorage, KEY, '1');
  return ok;
}

export function lock() { storageSet(sessionStorage, KEY, '0'); }
