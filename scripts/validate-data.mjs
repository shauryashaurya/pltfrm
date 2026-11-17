// Check the split study data before it ships. Errors fail the build; warnings are printed for review.
// Usage: npm run validate   (also runs first in npm run build)
import { pathToFileURL } from 'node:url';
import { loadRaw, loadDimensions, loadScopes, loadRenames } from './lib/data.mjs';
import { assembleStudy, ceilingFor } from '../src/data/model.js';

export function validate() {
  const errors = [], warnings = [];
  const err = m => errors.push(m), warn = m => warnings.push(m);
  const { study, products } = loadRaw();
  const dimensions = loadDimensions(), scopes = loadScopes(), renames = loadRenames();

  // Dimension registry, criteria and weights must name the same dimensions
  const dimKeys = dimensions.map(d => d.key);
  const same = (a, b) => a.length === b.length && a.every(k => b.includes(k));
  if (!same(dimKeys, Object.keys(study.criteria || {}))) err(`dimensions.json keys [${dimKeys}] differ from study.json criteria [${Object.keys(study.criteria || {})}]`);
  if (!same(dimKeys, Object.keys(study.dimensionWeights || {}))) err(`dimensions.json keys [${dimKeys}] differ from study.json dimensionWeights [${Object.keys(study.dimensionWeights || {})}]`);
  for (const f of ['key', 'letter', 'label', 'column', 'abbr', 'csv']) dimensions.forEach(d => { if (!d[f]) err(`dimensions.json: ${d.key || '?'} has no "${f}"`); });
  const letters = dimensions.map(d => d.letter);
  if (new Set(letters).size !== letters.length) err('dimensions.json: letters must be unique');
  if (letters.some(l => ['c', 'f'].includes(l))) err('dimensions.json: letters "c" and "f" are reserved (composite, confidence)');
  const critIds = Object.values(study.criteria || {}).flat().map(c => c.id);
  if (new Set(critIds).size !== critIds.length) err('study.json: criterion ids must be unique across dimensions');

  // Must-have default basis must point at real criteria
  (study.gates || []).forEach(g => (g.basis || []).forEach(b => { if (!study.criteria[b.dim]?.some(c => c.id === b.id)) err(`study.json: must-have ${g.area} basis names unknown criterion ${b.dim} / ${b.id}`); }));
  const mh = study.mustHaveDefaults;
  if (mh && !(mh.notMet < mh.met)) err('study.json: mustHaveDefaults.notMet must be below mustHaveDefaults.met');
  const VALID_MH = ['Pass', 'Fail', 'Unknown', 'N/A'];

  // Scopes and their ceilings must point at real criteria
  const scopeNames = scopes.map(s => s.name);
  for (const s of scopes) for (const [dim, m] of Object.entries(s.ceilings || {})) for (const cid of Object.keys(m)) if (!study.criteria[dim]?.some(c => c.id === cid)) err(`scopes.json: ${s.name} caps unknown criterion ${dim} / ${cid}`);

  // Product files: identity, scope, complete and in-range scores, provenance, must-haves
  const ids = new Set(), names = new Set();
  for (const { file, data: p } of products) {
    const at = `products/${file}`;
    if (p.id + '.json' !== file) err(`${at}: id "${p.id}" does not match the file name`);
    if (ids.has(p.id)) err(`${at}: duplicate id ${p.id}`); ids.add(p.id);
    if (!p.name) err(`${at}: no name`);
    if (names.has(p.name)) err(`${at}: duplicate name ${p.name}`); names.add(p.name);
    if (renames[p.name]) err(`${at}: name "${p.name}" is listed in renames.json as an old name`);
    if (!scopeNames.includes(p.scope)) err(`${at}: scope "${p.scope}" is not in scopes.json`);
    if (!['A', 'B', 'C', 'D', 'E'].includes(p.confidence)) err(`${at}: confidence "${p.confidence}" must be A-E`);
    for (const [dim, list] of Object.entries(study.criteria)) {
      const sc = p.scores?.[dim], st = p.scoreStatus?.[dim];
      if (!sc) { err(`${at}: no scores for dimension ${dim}`); continue; }
      for (const c of list) {
        const v = sc[c.id];
        if (v === undefined) err(`${at}: missing score ${dim} / ${c.id} (use null for unknown)`);
        else if (v !== null && !(typeof v === 'number' && v >= 0 && v <= 5)) err(`${at}: score ${dim} / ${c.id} = ${JSON.stringify(v)} must be null or 0-5`);
        if (!st?.[c.id]?.status) err(`${at}: missing provenance ${dim} / ${c.id}`);
        const cap = ceilingFor(p, scopes, dim, c.id);
        if (cap !== undefined && typeof v === 'number' && v > cap) warn(`${at}: ${dim} / ${c.id} = ${v} is above the ${p.scope} ceiling of ${cap} (npm run apply-ceilings, or keep it with evidence)`);
      }
      for (const k of Object.keys(sc)) if (!list.some(c => c.id === k)) err(`${at}: unknown criterion ${dim} / ${k}`);
    }
    for (const dim of Object.keys(p.scores || {})) if (!study.criteria[dim]) err(`${at}: unknown dimension ${dim}`);
    for (const k of Object.keys(p.gateStatus || {})) if (!(+k >= 0 && +k < (study.gates || []).length)) err(`${at}: must-have index ${k} is out of range`);
    for (const [k, v] of Object.entries(p.gateStatus || {})) if (!VALID_MH.includes(v)) err(`${at}: must-have ${k} status "${v}" must be one of ${VALID_MH.join(', ')}`);
  }

  // Order and references
  for (const id of study.productOrder || []) if (!ids.has(id)) err(`study.json productOrder lists "${id}" but products/${id}.json does not exist`);
  for (const id of ids) if (!(study.productOrder || []).includes(id)) warn(`products/${id}.json is not in study.json productOrder; it is listed last`);
  for (const k of ['focusProduct', 'benchmarkProduct']) { const v = study.settings?.[k]; if (v && !ids.has(v)) err(`study.json settings.${k} "${v}" is not a product id`); }
  for (const v of study.settings?.selectedGateProducts || []) if (!ids.has(v)) err(`study.json settings.selectedGateProducts "${v}" is not a product id`);

  // The assembled study must have the shape the app expects
  if (!errors.length) {
    const s = assembleStudy(study, products.map(p => p.data));
    if (s.products.length !== products.length) err('assembled study lost products');
  }
  return { errors, warnings, products: products.length };
}

export function report({ errors, warnings, products }) {
  warnings.forEach(w => console.warn('warning: ' + w));
  errors.forEach(e => console.error('error: ' + e));
  console.log(`Data check: ${products} products, ${errors.length} errors, ${warnings.length} warnings.`);
  return !errors.length;
}

if (import.meta.url === pathToFileURL(process.argv[1]).href) process.exit(report(validate()) ? 0 : 1);
