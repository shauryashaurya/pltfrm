// File exports (JSON, CSV), JSON import, and browser save/load/reset of the scenario
import { state, seed, setState, resetState, storageGet, storageSet } from '../core/state.js';
import { dl, toCSV, n } from '../core/format.js';
import { dims, allResults, tco } from '../core/scoring.js';
import { renderAll } from '../core/registry.js';
import { expose } from '../core/actions.js';
import { STORAGE_KEY, LEGACY_STORAGE_KEYS, EXPORT_FOOTER, mustHaveLabel } from '../config.js';
import { askConfirm, notify } from '../ui/dialog.js';

const included = () => state.products.filter(p => !p.hidden);

// The attribution goes last in the file; import drops it again so it never becomes part of the study
export function exportConfig() { dl('platform-study-scenario.json', JSON.stringify({ ...state, footer: EXPORT_FOOTER }, null, 2), 'application/json'); }

// One long CSV with Summary, TCO and MustHave sections; columns are the union of all section keys
export function exportResultsCSV() {
  const z = [], add = (Section, o) => z.push({ Section, ...o });
  allResults().forEach(r => add('Summary', { Offering: r.name, Category: r.category, Technical: n(r.t), Business: n(r.b), AI: n(r.a), Economics: n(r.o), DomainFit: n(r.d), AdoptionValue: n(r.v), Composite6D: n(r.c), Confidence: r.confidence, EvidenceAdjusted: n(r.adjusted) }));
  included().forEach(p => {
    const m = p.costModel || {}, c = tco(p.name);
    add('TCO', { Offering: p.name, Enabled: !!m.enabled, LicenseAnnual: m.licenseAnnual || 0, CloudAnnual: m.cloudAnnual || 0, SupportAnnual: m.supportAnnual || 0, ImplementationOneTime: m.implementationOneTime || 0, IntegrationOneTime: m.integrationOneTime || 0, TrainingOneTime: m.trainingOneTime || 0, OngoingFTE: m.ongoingFTE || 0, ChangeFTE: m.changeFTE || 0, OtherAnnual: m.otherAnnual || 0, ExitOneTime: m.exitOneTime || 0, LoadedFTECost: state.settings.loadedFTECost, HorizonYears: state.settings.costYears, DiscountRate: state.settings.discountRate, CashTCO: c.enabled ? c.total : '', NPV: c.enabled ? c.npv : '', Assumptions: m.notes || '' });
    state.gates.forEach((g, i) => add('MustHave', { Offering: p.name, MustHave: g.area, Status: mustHaveLabel((state.gateStatus[p.name] || {})[i] || 'Unknown'), RequiredEvidence: g.evidence }));
  });
  const keys = [...new Set(z.flatMap(x => Object.keys(x)))];
  dl('platform-study-complete.csv', toCSV(keys, z.map(r => keys.map(k => r[k]))), 'text/csv');
}

export function exportMustHavesCSV() {
  dl('must-haves.csv', toCSV(['Offering', ...state.gates.map(g => g.area)], included().map(p => [p.name, ...state.gates.map((g, i) => mustHaveLabel((state.gateStatus[p.name] || {})[i] || 'Unknown'))])), 'text/csv');
}

export function exportMethodologyCSV() {
  const rows = [];
  Object.keys(dims).forEach(d => state.criteria[d].forEach(c => rows.push([dims[d], state.dimensionWeights[d], c.name, c.weight, c.description || ''])));
  dl('six-dimensional-methodology.csv', toCSV(['Dimension', 'Dimension weight', 'Criterion', 'Criterion weight', 'Definition'], rows), 'text/csv');
}

// Validation plan and source register export every column as-is
function exportTable(name, rows) { const keys = Object.keys(rows[0] || {}); dl(name, toCSV(keys, rows.map(r => keys.map(k => r[k]))), 'text/csv'); }
export function exportValidationCSV() { exportTable('validation-plan.csv', state.validationPlan || []); }
export function exportSourcesCSV() { exportTable('official-documentation-register.csv', state.sources || []); }

// Import fills anything an older or partial file lacks from the seed, then replaces the state
function normalizeImported(x) {
  if (!x.products || !x.criteria || !x.scores) throw Error('Invalid schema: products, criteria and scores are required.');
  delete x.footer;
  x.validationPlan = x.validationPlan || seed.validationPlan;
  x.settings = { ...seed.settings, ...(x.settings || {}) };
  x.criteria = { ...seed.criteria, ...(x.criteria || {}) };
  x.dimensionWeights = { ...seed.dimensionWeights, ...(x.dimensionWeights || {}) };
  x.buyerReadiness = x.buyerReadiness || structuredClone(seed.buyerReadiness);
  x.scoreStatus = x.scoreStatus || {};
  x.gateStatus = x.gateStatus || {};
  x.products.forEach(p => {
    const sp = seed.products.find(q => q.name === p.name);
    x.scoreStatus[p.name] = x.scoreStatus[p.name] || {};
    p.notes = p.notes || '';
    p.costModel = { ...(sp?.costModel || {}), ...(p.costModel || {}) };
    p.riskOverlay = p.riskOverlay || structuredClone(sp?.riskOverlay || { deliveryUncertainty: 5, concentrationRisk: 3, buyerReadinessDependency: 5 });
    x.scores[p.name] = x.scores[p.name] || {};
    for (const d of Object.keys(dims)) {
      x.scores[p.name][d] = x.scores[p.name][d] || structuredClone(seed.scores[p.name]?.[d] || Object.fromEntries(seed.criteria[d].map(c => [c.id, null])));
      x.scoreStatus[p.name][d] = x.scoreStatus[p.name][d] || {};
      for (const c of seed.criteria[d]) if (!x.scoreStatus[p.name][d][c.id]) x.scoreStatus[p.name][d][c.id] = structuredClone(seed.scoreStatus[p.name]?.[d]?.[c.id] || { status: 'User input required', rationale: 'Imported or user-added product requires evidence-based score.', source: '', updated: '' });
    }
  });
  return x;
}

export function importFile(file) {
  if (!file) return;
  const reader = new FileReader();
  reader.onload = () => {
    try { setState(normalizeImported(JSON.parse(reader.result))); renderAll(); notify('Scenario imported.'); }
    catch (err) { notify('Could not import: ' + err.message); }
  };
  reader.readAsText(file);
}

// Browser save/load uses localStorage; earlier versions' keys are read as fallbacks
function saveLocal() { notify(storageSet(localStorage, STORAGE_KEY, JSON.stringify(state)) ? 'Scenario saved in this browser.' : 'This browser blocked saving. Use Export JSON instead.'); }

function loadLocal() {
  const raw = [STORAGE_KEY, ...LEGACY_STORAGE_KEYS].map(k => storageGet(localStorage, k)).find(Boolean);
  if (!raw) { notify('No saved scenario found in this browser.'); return; }
  try { setState(normalizeImported(JSON.parse(raw))); renderAll(); notify('Saved scenario loaded.'); }
  catch (err) { notify('Saved scenario could not be read: ' + err.message); }
}

async function resetAll() {
  if (!await askConfirm('Reset all changes to the packaged baseline? Unsaved edits are lost.', { okLabel: 'Reset', danger: true })) return;
  resetState();
  renderAll();
  notify('Baseline restored.');
}

expose({ exportConfig, exportResultsCSV, exportMustHavesCSV, exportMethodologyCSV, exportValidationCSV, exportSourcesCSV, saveLocal, loadLocal, resetAll });
