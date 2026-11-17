// Step 2 controls: include/exclude products, set evidence confidence, add or delete products
import { state } from '../core/state.js';
import { $, esc, enc } from '../core/format.js';
import { product } from '../core/scoring.js';
import { registerView, rerender, renderAll } from '../core/registry.js';
import { PB, expose } from '../core/actions.js';
import { askConfirm, notify } from '../ui/dialog.js';
import { SCOPES } from '../config.js';
import { newProduct } from '../data/model.js';

function renderProductList() {
  const sel = $('newScope');
  if (sel && !sel.options.length) sel.innerHTML = SCOPES.map(x => `<option>${esc(x)}</option>`).join('');
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
  const fields = { name, scope: $('newScope').value || SCOPES[0], category: $('newCategory').value.trim(), role: $('newRole').value.trim(), fit: $('newFit').value.trim(), boundary: $('newBoundary').value.trim(), notes: $('newNotes').value.trim() };
  const { record, scores, scoreStatus, gateStatus } = newProduct(fields, state.criteria);
  state.products.push(record);
  state.scores[name] = scores;
  state.scoreStatus[name] = scoreStatus;
  state.gateStatus[name] = gateStatus;
  ['newName', 'newCategory', 'newRole', 'newFit', 'newBoundary', 'newNotes'].forEach(id => { $(id).value = ''; });
  state.settings.focusProduct = name;
  renderAll();
  PB.openPanel('productMeta');
  notify(`${name} added. Enter its scores under Scores and evidence.`);
}

export function bindProducts() { $('productSearch').addEventListener('input', renderProductList); }

registerView('productList', renderProductList);
expose({ updateConfidence, toggleProduct, removeProduct, addProduct });
