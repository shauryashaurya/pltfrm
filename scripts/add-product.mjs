// Scaffold a new product file with every current criterion present (score null, "User input required"),
// a disabled cost model and default risk overlay, then add it to the end of study.json productOrder.
// Usage: npm run add-product -- --name "Product name" --scope "Specialized engine or database" [--category ..] [--role ..]
//        [--fit ..] [--boundary ..] [--notes ..] [--confidence A-E]
// --scope also accepts a scope code from scopes.json (P, C, D, A, E, F). Fill in scores in src/data/products/<id>.json,
// then run npm run validate (and npm run apply-ceilings if you want scope ceilings enforced).
import { loadStudy, loadScopes, writeStudy } from './lib/data.mjs';
import { newProduct, slugify } from '../src/data/model.js';
import { validate, report } from './validate-data.mjs';

const args = {};
for (let i = 2; i < process.argv.length; i++) {
  const m = process.argv[i].match(/^--(\w+)(?:=(.*))?$/);
  if (!m) { console.error('Unexpected argument: ' + process.argv[i]); process.exit(1); }
  args[m[1]] = m[2] ?? process.argv[++i];
}
const scopes = loadScopes();
const scope = scopes.find(s => s.name === args.scope || s.code === args.scope)?.name;
if (!args.name || !scope) {
  console.error('Usage: npm run add-product -- --name "Product name" --scope <scope name or code>');
  console.error('Scopes: ' + scopes.map(s => `${s.code} = ${s.name}`).join('; '));
  process.exit(1);
}

const state = loadStudy();
if (state.products.some(p => p.name === args.name)) { console.error(`A product named "${args.name}" already exists.`); process.exit(1); }
const id = slugify(args.name);
if (state.products.some(p => p.id === id)) { console.error(`Product id "${id}" is taken; choose a more distinct name.`); process.exit(1); }

const { record, scores, scoreStatus, gateStatus } = newProduct({ ...args, scope }, state.criteria);
state.products.push({ id, ...record });
state.scores[record.name] = scores;
state.scoreStatus[record.name] = scoreStatus;
state.gateStatus[record.name] = gateStatus;
writeStudy(state);

const cells = Object.values(scores).reduce((a, m) => a + Object.keys(m).length, 0);
console.log(`Created src/data/products/${id}.json (${cells} criteria to score, scope: ${scope}).`);
process.exit(report(validate()) ? 0 : 1);
