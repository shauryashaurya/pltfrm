// Publish a scenario exported from the app (Export > Export JSON scenario) as the packaged study.
// Splits it into src/data/study.json and one src/data/products/<id>.json per product, then validates.
// Usage: npm run import-scenario -- path/to/platform-study-scenario.json
import { readJSON, loadRenames, writeStudy } from './lib/data.mjs';
import { migrateRenames } from '../src/data/model.js';
import { validate, report } from './validate-data.mjs';

const file = process.argv[2];
if (!file) { console.error('Usage: npm run import-scenario -- <scenario.json>'); process.exit(1); }

const x = readJSON(file);
if (!Array.isArray(x.products) || !x.criteria || !x.scores) { console.error('Not a study scenario: products, criteria and scores are required.'); process.exit(1); }
delete x.footer;
migrateRenames(x, loadRenames());

const { products } = writeStudy(x);
console.log(`Wrote src/data/study.json and ${products.length} product files.`);
process.exit(report(validate()) ? 0 : 1);
