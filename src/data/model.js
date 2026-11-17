// Study data model shared by the app (via Vite) and the Node scripts in scripts/.
// Pure functions only: no JSON imports, no DOM, no fs, so both environments can load this file.
//
// On disk the study is split for easy editing:
//   src/data/study.json            everything that is not product-specific, plus productOrder (product ids, display order)
//   src/data/products/<id>.json    one file per product: metadata, cost model, risk overlay, must-have statuses, scores, provenance
//   src/data/dimensions.json       dimension registry (key, letter, labels); criteria themselves live in study.json
//   src/data/scopes.json           offering scopes and their score ceilings
//   src/data/renames.json          old product name -> current name, for older scenario files
//
// In memory the app keeps the shape it has always used (products array; scores, scoreStatus and gateStatus keyed by
// product name), so views, exports and saved scenarios are unchanged. Product ids are stable file names; on disk,
// settings that point at a product store its id, so renaming a product means editing one file.

// Settings that reference products: single values and lists
const PRODUCT_REF_SETTINGS = ['focusProduct', 'benchmarkProduct'];
const PRODUCT_LIST_SETTINGS = ['selectedGateProducts', 'heatmapProducts', 'riskHidden'];

// Key order inside a product file: identity and context first, bulky score maps last
const PRODUCT_KEY_ORDER = ['id', 'name', 'scope', 'confidence', 'category', 'role', 'fit', 'boundary', 'notes'];
const PRODUCT_TAIL = ['costModel', 'riskOverlay', 'gateStatus', 'scores', 'scoreStatus'];

export function slugify(name) {
  return String(name).toLowerCase().replace(/&/g, ' and ').replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '') || 'product';
}

const mapRefs = (settings, fn) => {
  const s = { ...settings };
  PRODUCT_REF_SETTINGS.forEach(k => { if (typeof s[k] === 'string') s[k] = fn(s[k]); });
  PRODUCT_LIST_SETTINGS.forEach(k => { if (Array.isArray(s[k])) s[k] = s[k].map(fn); });
  return s;
};

// study.json + product files -> in-memory study (name-keyed). Files missing from productOrder are appended by id.
export function assembleStudy(study, productFiles) {
  const byId = new Map(productFiles.map(f => [f.id, f]));
  const order = (study.productOrder || []).filter(id => byId.has(id));
  const rest = [...byId.keys()].filter(id => !order.includes(id)).sort();
  const products = [], scores = {}, scoreStatus = {}, gateStatus = {};
  for (const id of [...order, ...rest]) {
    const { scores: sc, scoreStatus: st, gateStatus: gs, ...record } = structuredClone(byId.get(id));
    products.push(record);
    scores[record.name] = sc || {};
    scoreStatus[record.name] = st || {};
    gateStatus[record.name] = gs || {};
  }
  const nameOf = id => byId.get(id)?.name ?? id;
  const { productOrder, ...rest2 } = structuredClone(study);
  return { ...rest2, settings: mapRefs(rest2.settings || {}, nameOf), products, scores, scoreStatus, gateStatus };
}

// In-memory study (or an exported scenario) -> { study, products } for writing to disk.
// Existing ids are kept; products without one get a unique slug of their name.
export function splitStudy(state) {
  const used = new Set(), idOf = {};
  const products = state.products.map(p => {
    let id = p.id || slugify(p.name);
    if (used.has(id)) { let i = 2; while (used.has(`${id}-${i}`)) i++; id = `${id}-${i}`; }
    used.add(id);
    idOf[p.name] = id;
    const full = { ...structuredClone(p), id, gateStatus: structuredClone(state.gateStatus?.[p.name] || {}), scores: structuredClone(state.scores?.[p.name] || {}), scoreStatus: structuredClone(state.scoreStatus?.[p.name] || {}) };
    const keys = [...PRODUCT_KEY_ORDER.filter(k => k in full), ...Object.keys(full).filter(k => !PRODUCT_KEY_ORDER.includes(k) && !PRODUCT_TAIL.includes(k)), ...PRODUCT_TAIL.filter(k => k in full)];
    return Object.fromEntries(keys.map(k => [k, full[k]]));
  });
  const { products: _p, scores: _s, scoreStatus: _st, gateStatus: _g, footer: _f, ...rest } = structuredClone(state);
  const study = { ...rest, settings: mapRefs(rest.settings || {}, n => idOf[n] ?? n), productOrder: products.map(p => p.id) };
  return { study, products };
}

// Older files use earlier product names; move each renamed product's record, keyed maps and settings references
export function migrateRenames(x, renames) {
  for (const [from, to] of Object.entries(renames || {})) {
    const p = x.products?.find(q => q.name === from);
    if (!p || x.products.some(q => q.name === to)) continue;
    p.name = to;
    for (const k of ['scores', 'scoreStatus', 'gateStatus']) if (x[k]?.[from]) { x[k][to] = x[k][from]; delete x[k][from]; }
    if (x.settings) x.settings = mapRefs(x.settings, n => n === from ? to : n);
  }
  return x;
}

// Default records for a new product: everything off or unknown until evidence is entered
export function blankCostModel() {
  return { enabled: false, licenseAnnual: 0, cloudAnnual: 0, supportAnnual: 0, implementationOneTime: 0, integrationOneTime: 0, trainingOneTime: 0, ongoingFTE: 0, changeFTE: 0, otherAnnual: 0, exitOneTime: 0, notes: '', annualBenefit: 0, benefitRampMonths: 0, benefitConfidence: 50, benefitNotes: '', legacySavingsAnnual: 0 };
}
export function blankRiskOverlay() {
  return { deliveryUncertainty: 5, concentrationRisk: 3, buyerReadinessDependency: 5, p50Months: 0, p90Months: 0, lowTcoFactor: .85, highTcoFactor: 1.35, notes: '' };
}

// A complete new product: record plus a null score and a "User input required" tag for every current criterion
export function newProduct(fields, criteria) {
  const record = { name: fields.name, scope: fields.scope, confidence: fields.confidence || 'E', category: fields.category || 'User-defined', role: fields.role || '', fit: fields.fit || '', boundary: fields.boundary || 'Requires user validation', notes: fields.notes || '', costModel: blankCostModel(), riskOverlay: blankRiskOverlay() };
  const scores = {}, scoreStatus = {};
  for (const [dim, list] of Object.entries(criteria)) {
    scores[dim] = Object.fromEntries(list.map(c => [c.id, null]));
    scoreStatus[dim] = Object.fromEntries(list.map(c => [c.id, { status: 'User input required', rationale: 'New product: no packaged baseline. Enter evidence-based score.', source: '', updated: '' }]));
  }
  return { record, scores, scoreStatus, gateStatus: {} };
}

// Score ceiling for one cell: the product's own override first, then its scope's ceiling; undefined means no cap
export function ceilingFor(product, scopes, dim, cid) {
  const own = product.scopeCeilingOverrides?.[dim]?.[cid];
  if (own !== undefined) return own;
  return scopes.find(s => s.name === product.scope)?.ceilings?.[dim]?.[cid];
}

// Default must-have status from the criterion scores behind it (study.json gates[i].basis, thresholds in mustHaveDefaults):
// N/A when the product's scope caps every basis criterion (the scope does not deliver that layer), Pass when the weakest
// basis score reaches 'met', Fail at or below 'notMet', otherwise Unknown (needs a check). Unscored basis cells give Unknown.
export function defaultMustHave(product, scores, gate, scopes, thresholds = { met: 4, notMet: 1.5 }) {
  const basis = gate.basis || [];
  if (!basis.length) return 'Unknown';
  if (basis.every(b => ceilingFor(product, scopes, b.dim, b.id) !== undefined)) return 'N/A';
  const vals = basis.map(b => scores?.[b.dim]?.[b.id]);
  if (vals.some(v => typeof v !== 'number')) return 'Unknown';
  const low = Math.min(...vals);
  return low >= thresholds.met ? 'Pass' : low <= thresholds.notMet ? 'Fail' : 'Unknown';
}
