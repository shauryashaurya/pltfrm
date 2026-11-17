// File access for the split study data (see src/data/model.js for the layout). Used by every script in scripts/.
import { readFileSync, writeFileSync, readdirSync, mkdirSync, unlinkSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import { assembleStudy, splitStudy } from '../../src/data/model.js';

export const DATA = 'src/data';
export const PRODUCTS = join(DATA, 'products');

export const readJSON = path => JSON.parse(readFileSync(path, 'utf8'));
// Pretty-printed with a trailing newline so diffs show one changed score per line
export const writeJSON = (path, value) => writeFileSync(path, JSON.stringify(value, null, 2) + '\n');

export const loadDimensions = () => readJSON(join(DATA, 'dimensions.json'));
export const loadScopes = () => readJSON(join(DATA, 'scopes.json'));
export const loadRenames = () => readJSON(join(DATA, 'renames.json'));

// Raw files as stored: study.json, and every product file with its file name
export function loadRaw() {
  const study = readJSON(join(DATA, 'study.json'));
  const files = existsSync(PRODUCTS) ? readdirSync(PRODUCTS).filter(f => f.endsWith('.json')).sort() : [];
  const products = files.map(file => ({ file, data: readJSON(join(PRODUCTS, file)) }));
  return { study, products };
}

// The in-memory study, exactly as the app builds it
export function loadStudy() {
  const { study, products } = loadRaw();
  return assembleStudy(study, products.map(p => p.data));
}

// Write an in-memory study back to disk; product files no longer in the study are removed
export function writeStudy(state) {
  const { study, products } = splitStudy(state);
  mkdirSync(PRODUCTS, { recursive: true });
  writeJSON(join(DATA, 'study.json'), study);
  const keep = new Set(products.map(p => p.id + '.json'));
  for (const p of products) writeJSON(join(PRODUCTS, p.id + '.json'), p);
  for (const f of readdirSync(PRODUCTS)) if (f.endsWith('.json') && !keep.has(f)) unlinkSync(join(PRODUCTS, f));
  return { study, products };
}
