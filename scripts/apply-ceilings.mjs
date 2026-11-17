// Lower any score above its scope ceiling (src/data/scopes.json, or a product's own scopeCeilingOverrides) to the
// ceiling, tag it "Rescored for platform scope" and keep the prior score. Never raises a score.
// Usage: npm run apply-ceilings            apply and write the product files
//        npm run apply-ceilings -- --dry   list what would change
import { loadStudy, loadScopes, writeStudy } from './lib/data.mjs';
import { ceilingFor } from '../src/data/model.js';

const dry = process.argv.includes('--dry');
const date = new Date().toISOString().slice(0, 10);
const state = loadStudy(), scopes = loadScopes();
let changed = 0;

for (const p of state.products) for (const [dim, list] of Object.entries(state.criteria)) for (const c of list) {
  const cap = ceilingFor(p, scopes, dim, c.id), cur = state.scores[p.name]?.[dim]?.[c.id];
  if (cap === undefined || typeof cur !== 'number' || cur <= cap) continue;
  changed++;
  console.log(`${p.name} | ${dim} | ${c.id}: ${cur} -> ${cap}`);
  if (dry) continue;
  const st = state.scoreStatus[p.name][dim][c.id] || {};
  const prior = st.priorScore ?? cur;
  state.scores[p.name][dim][c.id] = cap;
  state.scoreStatus[p.name][dim][c.id] = {
    status: String(st.status || '').includes('User') ? 'Rescored for platform scope - User input still required' : 'Rescored for platform scope - validate',
    rationale: `${p.scope} ceiling of ${cap} for this platform-level criterion. Prior score: ${prior}.${st.rationale ? ' Prior rationale: ' + st.rationale : ''}`,
    source: `Scope ceilings (${date})`, updated: date, priorScore: prior
  };
}

if (changed && !dry) writeStudy(state);
console.log(`${changed} cell(s) above ceiling${dry ? ' (dry run, nothing written)' : changed ? ' lowered' : ''}.`);
