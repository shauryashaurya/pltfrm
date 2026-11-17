// Fill must-have statuses that have not been recorded, from the criterion scores behind each must-have
// (study.json gates[i].basis; thresholds in study.json mustHaveDefaults). Recorded statuses are never changed.
//   Not applicable  the product's scope caps every basis criterion
//   Met             weakest basis score >= mustHaveDefaults.met
//   Not met         weakest basis score <= mustHaveDefaults.notMet
//   Not checked     anything in between, or a basis criterion is unscored (left unrecorded)
// Usage: npm run default-must-haves             fill and write the product files
//        npm run default-must-haves -- --dry    count what would be filled
//        npm run default-must-haves -- --reset  recompute every status, discarding recorded ones
import { loadStudy, loadScopes, writeStudy } from './lib/data.mjs';
import { defaultMustHave } from '../src/data/model.js';

const dry = process.argv.includes('--dry'), reset = process.argv.includes('--reset');
const state = loadStudy(), scopes = loadScopes(), th = state.mustHaveDefaults;
const tally = { Pass: 0, Fail: 0, 'N/A': 0, Unknown: 0 };
let filled = 0;

for (const p of state.products) {
  const gs = state.gateStatus[p.name] = reset ? {} : (state.gateStatus[p.name] || {});
  state.gates.forEach((g, i) => {
    if (gs[i] && gs[i] !== 'Unknown') return;
    const v = defaultMustHave(p, state.scores[p.name], g, scopes, th);
    tally[v]++;
    if (v === 'Unknown') { delete gs[i]; return; }
    gs[i] = v;
    filled++;
  });
}

if (filled && !dry) writeStudy(state);
console.log(`${filled} must-have status(es) ${dry ? 'would be ' : ''}filled: ${tally.Pass} met, ${tally.Fail} not met, ${tally['N/A']} not applicable; ${tally.Unknown} left not checked.`);
