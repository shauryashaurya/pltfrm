// Scoring model: criterion scores (0-5) -> dimension scores (0-100) -> 6D composite -> evidence-adjusted value
import { state } from './state.js';
import { esc } from './format.js';

export const dims = { technical: 'Technical & enterprise', business: 'Business/platform', ai: 'AI & agentic', economics: 'Delivery & operating economics', domain: 'Domain & use-case fit', adoption: 'Adoption & value realization' };

export function product(name) { return state.products.find(p => p.name === name); }

// Criterion weights normalize to shares of 1 within a dimension
export function normalizedWeights(criteria) {
  const sum = criteria.reduce((a, c) => a + (+c.weight || 0), 0);
  return criteria.map(c => sum ? ((+c.weight || 0) / sum) : 1 / criteria.length);
}

// Weighted average of one product's criterion scores in a dimension, scaled to 0-100; unknowns count as 0 or are excluded
export function dimensionScore(name, dim) {
  const cs = state.criteria[dim], ws = normalizedWeights(cs), map = state.scores[name]?.[dim] || {};
  let total = 0, used = 0;
  cs.forEach((c, i) => {
    const v = map[c.id];
    if (v === null || v === undefined || v === '') { if (state.settings.unknownScoreTreatment === 'zero') used += ws[i]; }
    else { total += (+v) * ws[i]; used += ws[i]; }
  });
  return used ? total / used * 20 : 0;
}

// Same as dimensionScore but over a subset of technical criteria (scale vs enterprise sub-scores)
export function subScore(name, ids) {
  const cs = state.criteria.technical.filter(c => ids.includes(c.id));
  if (!cs.length) return 0;
  const ws = normalizedWeights(cs), m = state.scores[name].technical;
  let total = 0, used = 0;
  cs.forEach((c, i) => {
    const v = m[c.id];
    if (v == null) { if (state.settings.unknownScoreTreatment === 'zero') used += ws[i]; }
    else { total += v * ws[i]; used += ws[i]; }
  });
  return used ? total / used * 20 : 0;
}

// Combine six dimension scores with normalized dimension weights (geometric limits compensation, arithmetic allows it)
export function composite(vals) {
  const dw = state.dimensionWeights, keys = Object.keys(dims), weights = keys.map(k => +dw[k] || 0), sum = weights.reduce((a, b) => a + b, 0) || 1, w = weights.map(x => x / sum);
  if (state.settings.compositeMethod === 'arithmetic') return vals.reduce((a, v, i) => a + v * w[i], 0);
  return Math.exp(vals.reduce((a, v, i) => a + w[i] * Math.log(Math.max(v, .001)), 0));
}

// Count must-have statuses for a product (N/A counts with unknown, as in v7)
export function mustHaveSummary(name) {
  const gs = state.gateStatus[name] || {};
  let fail = 0, pass = 0, unknown = 0;
  state.gates.forEach((g, i) => { const s = gs[i] || 'Unknown'; s === 'Pass' ? pass++ : s === 'Fail' ? fail++ : unknown++; });
  return { pass, fail, unknown };
}

export function costModel(name) { return product(name)?.costModel || { enabled: false }; }

// Cash TCO and NPV over the configured horizon from the buyer-entered cost model
export function tco(name) {
  const m = costModel(name), years = Math.max(1, +state.settings.costYears || 3), rate = (+state.settings.discountRate || 0) / 100, fte = +state.settings.loadedFTECost || 0;
  if (!m.enabled) return { enabled: false, total: null, npv: null, annual: null, oneTime: null, runAnnual: null, exit: null };
  const one = (+m.implementationOneTime || 0) + (+m.integrationOneTime || 0) + (+m.trainingOneTime || 0);
  const run = (+m.licenseAnnual || 0) + (+m.cloudAnnual || 0) + (+m.supportAnnual || 0) + (+m.otherAnnual || 0) + ((+m.ongoingFTE || 0) + (+m.changeFTE || 0)) * fte;
  const exit = +m.exitOneTime || 0, total = one + run * years + exit;
  let npv = one;
  for (let y = 1; y <= years; y++) npv += run / Math.pow(1 + rate, y);
  npv += exit / Math.pow(1 + rate, years);
  return { enabled: true, total, npv, annual: run, oneTime: one, runAnnual: run, exit, years };
}

// Benefit, ROI and payback from the value-realization inputs
export function benefits(name) {
  const m = product(name)?.costModel || {}, years = Math.max(1, +state.settings.benefitYears || +state.settings.costYears || 3);
  if (!m.enabled || !(+m.annualBenefit || +m.legacySavingsAnnual)) return { enabled: false };
  const annual = (+m.annualBenefit || 0) + (+m.legacySavingsAnnual || 0), ramp = Math.max(0, Math.min(12, +m.benefitRampMonths || 0));
  const first = annual * (1 - ramp / 24), gross = first + annual * Math.max(0, years - 1), conf = (+m.benefitConfidence || 0) / 100, riskAdjusted = gross * conf;
  const c = tco(name), net = gross - (c.total || 0), riskNet = riskAdjusted - (c.total || 0), roi = c.total ? net / c.total * 100 : null;
  const payback = (annual - (c.runAnnual || 0)) > 0 ? (c.oneTime || 0) / (annual - (c.runAnnual || 0)) * 12 : null;
  return { enabled: true, annual, gross, riskAdjusted, net, riskNet, roi, payback, years };
}

export function econKey(dim) { return ({ technical: 't', business: 'b', ai: 'a', economics: 'o', domain: 'd', adoption: 'v' })[dim] || 't'; }

// One result row per included product, sorted by raw composite (the report's ordering)
export function allResults() {
  return state.products.filter(p => !p.hidden).map(p => {
    const t = dimensionScore(p.name, 'technical'), b = dimensionScore(p.name, 'business'), a = dimensionScore(p.name, 'ai'), o = dimensionScore(p.name, 'economics'), d = dimensionScore(p.name, 'domain'), v = dimensionScore(p.name, 'adoption');
    const c = composite([t, b, a, o, d, v]), f = state.confidenceFactors[p.confidence] ?? .25;
    const scale = subScore(p.name, state.scaleCriteria), ent = subScore(p.name, state.criteria.technical.filter(x => !state.scaleCriteria.includes(x.id)).map(x => x.id));
    return { name: p.name, category: p.category, confidence: p.confidence, t, b, a, o, d, v, c, adjusted: c * f, scale, enterprise: ent, cost: tco(p.name), risk: p.riskOverlay || {}, gates: mustHaveSummary(p.name), role: p.role || '', fit: p.fit || '', boundary: p.boundary || '', notes: p.notes || '' };
  }).sort((x, y) => y.c - x.c);
}

// Value shown in rankings: evidence-adjusted when that setting is on
export function displayValue(r) { return state.settings.showEvidenceAdjusted ? r.adjusted : r.c; }

export function status(r) {
  if (r.gates.fail) return 'Must-have not met';
  if (r.gates.unknown) return 'Must-haves not all checked';
  if (r.c >= state.settings.shortlistThreshold) return 'Threshold met';
  return 'Below threshold';
}

export function buyerReadinessScore() {
  const b = state.buyerReadiness, sw = b.criteria.reduce((a, c) => a + (+c.weight || 0), 0) || 1;
  return b.criteria.reduce((a, c) => a + (+b.scores[c.id] || 0) * (+c.weight || 0), 0) / sw * 20;
}

// Decision-risk overlay measures (0 low to 5 high); "combined" is their unweighted mean
export const RISK_MEASURES = { combined: 'Combined risk', deliveryUncertainty: 'Delivery uncertainty', concentrationRisk: 'Concentration/lock-in risk', buyerReadinessDependency: 'Buyer-readiness dependency' };
export function riskScore(r, measure) {
  const k = r.risk || {};
  if (measure !== 'combined') return +k[measure] || 0;
  return ((+k.deliveryUncertainty || 0) + (+k.concentrationRisk || 0) + (+k.buyerReadinessDependency || 0)) / 3;
}

export function riskClass(v) { return v >= 4 ? 'risk-high' : v >= 2.5 ? 'risk-med' : 'risk-low'; }

// Score provenance: who set a score and how decision-ready it is
export function scoreMeta(name, dim, cid) {
  return state.scoreStatus?.[name]?.[dim]?.[cid] || { status: 'User input required', rationale: 'No packaged score provenance is available.', source: '', updated: '' };
}

export function statusClass(s) { return s.includes('User') ? 'st-user' : s.includes('cost') || s.includes('buyer') ? 'st-cost' : s.includes('workload') ? 'st-workload' : 'st-base'; }

export function scoreCoverage() {
  let total = 0, missing = 0, user = 0, validate = 0;
  state.products.filter(p => !p.hidden).forEach(p => Object.keys(dims).forEach(d => state.criteria[d].forEach(c => {
    total++;
    const v = state.scores[p.name]?.[d]?.[c.id], m = scoreMeta(p.name, d, c.id);
    if (v == null || v === '') missing++;
    if (m.status.includes('User')) user++; else validate++;
  })));
  return { total, missing, user, validate };
}

export function categories() { return ['All', ...new Set(state.products.filter(p => !p.hidden).map(p => p.category))].sort((a, b) => a === 'All' ? -1 : a.localeCompare(b)); }
export function productOptions(selected) { return state.products.filter(p => !p.hidden).map(p => `<option value="${esc(p.name)}" ${p.name === selected ? 'selected' : ''}>${esc(p.name)}</option>`).join(''); }
export function categoryOptions(selected) { return categories().map(c => `<option value="${esc(c)}" ${c === selected ? 'selected' : ''}>${esc(c)}</option>`).join(''); }
export function resultByName(rows, name) { return rows.find(r => r.name === name) || rows[0]; }
export function topRows(rows, count = 10) { return rows.slice(0, Math.min(count, rows.length)); }
