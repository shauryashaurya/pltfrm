// Step 3 controls: dimension weights (slider + number), criterion weights, presets and undo/redo
import { state } from '../core/state.js';
import { $, esc, n } from '../core/format.js';
import { dims } from '../core/scoring.js';
import { registerView, rerender } from '../core/registry.js';
import { expose } from '../core/actions.js';
import { WEIGHT_PRESETS } from '../config.js';
import { commitWeights, undoWeights, redoWeights, historyState, resetHistory } from '../core/history.js';
import { notify } from '../ui/dialog.js';

// Live edits recompute the ranking; undo snapshots are taken on "change" (see bindWeights)
function updateDimensionWeight(d, v) {
  state.dimensionWeights[d] = Math.max(0, +v || 0);
  const range = $('dr-' + d), num = $('dw-' + d);
  if (range && range.value !== String(v)) range.value = v;
  if (num && num.value !== String(v)) num.value = v;
  updateTotals();
  rerender('report', 'comparison');
}

function updateCriterionWeight(d, i, v) {
  state.criteria[d][i].weight = Math.max(0, +v || 0);
  updateTotals();
  rerender('report', 'comparison');
}

// Normalized shares and totals update in place so inputs keep focus while typing
function updateTotals() {
  const ds = Object.values(state.dimensionWeights).reduce((a, b) => a + (+b || 0), 0);
  Object.keys(dims).forEach(d => { const e = $('dn-' + d); if (e) e.textContent = n(100 * (+state.dimensionWeights[d] || 0) / (ds || 1)) + '%'; });
  $('dimTotal').innerHTML = `Relative total: <b>${n(ds)}</b>${Math.abs(ds - 100) > .2 ? ' - normalized automatically' : ''}`;
  const d = $('weightDimension').value, cs = state.criteria[d], sum = cs.reduce((a, c) => a + (+c.weight || 0), 0) || 1;
  cs.forEach((c, i) => { const e = $(`norm-${d}-${i}`); if (e) e.textContent = n(100 * (+c.weight || 0) / sum) + '%'; });
  const t = $('criterionTotal');
  if (t) { t.className = 'weight-total ' + (Math.abs(sum - 100) < .2 ? 'ok' : 'warn'); t.textContent = 'Relative total: ' + n(sum) + '% - normalized automatically'; }
  updateHistoryButtons();
}

function updateHistoryButtons() {
  const h = historyState();
  $('undoWeights').disabled = !h.canUndo;
  $('redoWeights').disabled = !h.canRedo;
  $('undoWeights').textContent = h.undoCount ? `Undo (${h.undoCount})` : 'Undo';
}

function renderCriterionWeights() {
  const d = $('weightDimension').value, cs = state.criteria[d];
  $('criteriaWeights').innerHTML = cs.map((c, i) => `<div class="form-row"><label for="cw-${d}-${i}" title="${esc(c.description)}">${esc(c.name)}<span class="ux-note">Normalized: <span id="norm-${d}-${i}" class="weight-normal"></span></span></label><input id="cw-${d}-${i}" type="number" min="0" step=".1" value="${c.weight}" oninput="PB.updateCriterionWeight('${d}',${i},this.value)"></div>`).join('') + `<div id="criterionTotal" class="weight-total"></div>`;
  updateTotals();
}

function renderWeights() {
  $('dimWeights').innerHTML = Object.keys(dims).map(d => `<div class="wrow"><label for="dw-${d}">${dims[d]}</label><input id="dr-${d}" type="range" min="0" max="50" step=".5" value="${state.dimensionWeights[d]}" aria-label="${dims[d]} weight slider" oninput="PB.updateDimensionWeight('${d}',this.value)"><input id="dw-${d}" type="number" min="0" step=".1" value="${state.dimensionWeights[d]}" oninput="PB.updateDimensionWeight('${d}',this.value)"><span class="norm" id="dn-${d}"></span></div>`).join('');
  renderCriterionWeights();
}

// Presets replace dimension weights and any listed criterion weights as one undoable step
function applyPreset() {
  const p = WEIGHT_PRESETS[$('weightPreset').value];
  if (!p) return;
  state.dimensionWeights = { ...p.dimensions };
  Object.entries(p.criteria || {}).forEach(([d, map]) => state.criteria[d].forEach(c => { if (c.id in map) c.weight = map[c.id]; }));
  commitWeights();
  renderWeights();
  rerender('report', 'comparison');
  notify(`Applied "${p.label}". Use Undo to go back.`);
}

function step(fn) { if (fn()) { renderWeights(); rerender('report', 'comparison'); } }

export function bindWeights() {
  $('weightPreset').innerHTML = Object.entries(WEIGHT_PRESETS).map(([k, p]) => `<option value="${k}">${esc(p.label)}</option>`).join('');
  $('weightDimension').addEventListener('change', renderCriterionWeights);
  // A finished edit (slider released, number committed) becomes one undo step
  $('weightsPanel').addEventListener('change', e => { if (e.target.matches('input')) { commitWeights(); updateHistoryButtons(); } });
  $('undoWeights').addEventListener('click', () => step(undoWeights));
  $('redoWeights').addEventListener('click', () => step(redoWeights));
  $('applyPreset').addEventListener('click', applyPreset);
  resetHistory();
}

registerView('weights', renderWeights);
expose({ updateDimensionWeight, updateCriterionWeight });
