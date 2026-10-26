// Step 2 controls: include/exclude products, set evidence confidence, add or delete products
import { state } from '../core/state.js';
import { $, esc, enc } from '../core/format.js';
import { dims, product } from '../core/scoring.js';
import { registerView, rerender, renderAll } from '../core/registry.js';
import { PB, expose } from '../core/actions.js';
import { askConfirm, notify } from '../ui/dialog.js';

function renderProductList() {
  const q = $('productSearch').value.toLowerCase();
  $('productList').innerHTML = state.products.filter(p => p.name.toLowerCase().includes(q)).map(p => `<div class="form-row three"><label><input type="checkbox" ${p.hidden ? '' : 'checked'} onchange="PB.toggleProduct('${enc(p.name)}',this.checked)"> ${esc(p.name)}</label><select aria-label="Evidence confidence for ${esc(p.name)}" onchange="PB.updateConfidence('${enc(p.name)}',this.value)">${Object.keys(state.confidenceFactors).map(c => `<option ${p.confidence === c ? 'selected' : ''}>${c}</option>`).join('')}</select><button class="btn danger small" type="button" onclick="PB.removeProduct('${enc(p.name)}')">Delete</button></div>`).join('');
}

function updateConfidence(encName, v) { product(decodeURIComponent(encName)).confidence = v; rerender('report', 'comparison'); }
function toggleProduct(encName, shown) { product(decodeURIComponent(encName)).hidden = !shown; renderAll(); }

// Deleting removes the product's scores and must-have statuses too; focus/benchmark fall back to the first product
async function removeProduct(encName) {
  const name = decodeURIComponent(encName);
  if (!await askConfirm(`Delete ${name} from this scenario? Its scores and must-have statuses are removed too.`, { okLabel: 'Delete', danger: true })) return;
  state.products = state.products.filter(p => p.name !== name);
  delete state.scores[name];
  delete state.gateStatus[name];
  if (state.settings.focusProduct === name) state.settings.focusProduct = state.products[0]?.name || '';
  if (state.settings.benchmarkProduct === name) state.settings.benchmarkProduct = state.products[0]?.name || '';
  renderAll();
}

// New products start with unknown scores, confidence E and a disabled cost model
function addProduct() {
  const name = $('newName').value.trim();
  if (!name || product(name)) { notify('Enter a unique product name.'); return; }
  state.products.push({ name, category: $('newCategory').value.trim() || 'User-defined', role: $('newRole').value.trim(), fit: $('newFit').value.trim(), boundary: $('newBoundary').value.trim() || 'Requires user validation', notes: $('newNotes').value.trim(), confidence: 'E', riskOverlay: { deliveryUncertainty: 5, concentrationRisk: 3, buyerReadinessDependency: 5, p50Months: 0, p90Months: 0, lowTcoFactor: .85, highTcoFactor: 1.35, notes: '' }, costModel: { enabled: false, licenseAnnual: 0, cloudAnnual: 0, supportAnnual: 0, implementationOneTime: 0, integrationOneTime: 0, trainingOneTime: 0, ongoingFTE: 0, changeFTE: 0, otherAnnual: 0, exitOneTime: 0, annualBenefit: 0, legacySavingsAnnual: 0, benefitRampMonths: 0, benefitConfidence: 50, benefitNotes: '', notes: '' } });
  state.scores[name] = {};
  state.scoreStatus[name] = {};
  Object.keys(dims).forEach(d => {
    state.scores[name][d] = {};
    state.scoreStatus[name][d] = {};
    state.criteria[d].forEach(c => { state.scores[name][d][c.id] = null; state.scoreStatus[name][d][c.id] = { status: 'User input required', rationale: 'New product: no packaged baseline. Enter evidence-based score.', source: '', updated: '' }; });
  });
  state.gateStatus[name] = {};
  ['newName', 'newCategory', 'newRole', 'newFit', 'newBoundary', 'newNotes'].forEach(id => { $(id).value = ''; });
  state.settings.focusProduct = name;
  renderAll();
  PB.openPanel('productMeta');
  notify(`${name} added. Enter its scores under Scores and evidence.`);
}

export function bindProducts() { $('productSearch').addEventListener('input', renderProductList); }

registerView('productList', renderProductList);
expose({ updateConfidence, toggleProduct, removeProduct, addProduct });
