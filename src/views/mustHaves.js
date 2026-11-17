// Must-haves (stored as "gates"): filterable product x requirement matrix with bulk status changes
import { state } from '../core/state.js';
import { $, esc, enc, n, sessionNote } from '../core/format.js';
import { mustHaveSummary } from '../core/scoring.js';
import { registerView, rerender } from '../core/registry.js';
import { expose } from '../core/actions.js';
import { MUST_HAVE_VALUES, mustHaveLabel } from '../config.js';
import { askConfirm, notify } from '../ui/dialog.js';

const STATE_FILTERS = [['All', 'All products'], ['Failed', 'Any not met'], ['Unknown', 'Any not checked'], ['Passed', 'All met']];

// Products and requirement columns that pass the current filters
function filteredProducts() {
  const q = (state.settings.gateProductFilter || '').toLowerCase(), f = state.settings.gateStatusFilter || 'All';
  return state.products.filter(p => !p.hidden && (!q || p.name.toLowerCase().includes(q))).filter(p => {
    if (f === 'All') return true;
    const g = mustHaveSummary(p.name);
    return f === 'Failed' ? g.fail > 0 : f === 'Unknown' ? g.unknown > 0 : f === 'Passed' ? g.pass === state.gates.length : false;
  });
}

function visibleAreas() {
  const f = state.settings.gateAreaFilter || 'All';
  return state.gates.map((g, i) => ({ g, i })).filter(x => f === 'All' || x.g.area === f);
}

function setFilter(key, value) { state.settings[key] = value; rerender('mustHaves'); }

// Row and column selection drives the bulk "apply to selected" action
function toggleRow(encName, on) { const x = new Set(state.settings.selectedGateProducts || []), name = decodeURIComponent(encName); on ? x.add(name) : x.delete(name); state.settings.selectedGateProducts = [...x]; rerender('mustHaves'); }
function toggleCol(i, on) { const x = new Set(state.settings.selectedGateAreas || []); on ? x.add(i) : x.delete(i); state.settings.selectedGateAreas = [...x]; rerender('mustHaves'); }
function selectRows(on) { const x = new Set(state.settings.selectedGateProducts || []); filteredProducts().forEach(p => on ? x.add(p.name) : x.delete(p.name)); state.settings.selectedGateProducts = [...x]; rerender('mustHaves'); }
function selectCols(on) { const x = new Set(state.settings.selectedGateAreas || []); visibleAreas().forEach(a => on ? x.add(a.i) : x.delete(a.i)); state.settings.selectedGateAreas = [...x]; rerender('mustHaves'); }
function clearSelection() { state.settings.selectedGateProducts = []; state.settings.selectedGateAreas = []; rerender('mustHaves'); }

async function bulkSet(value) {
  const ps = state.settings.selectedGateProducts || [], as = state.settings.selectedGateAreas || [];
  if (!ps.length || !as.length) { notify('Select product rows and must-have columns first.'); return; }
  if (!await askConfirm(`Set ${ps.length * as.length} must-have checks to "${mustHaveLabel(value)}"?`, { okLabel: 'Apply' })) return;
  ps.forEach(name => { state.gateStatus[name] = state.gateStatus[name] || {}; as.forEach(i => { state.gateStatus[name][i] = value; }); });
  rerender('mustHaves', 'report');
}

function setOne(encName, i, value) {
  const name = decodeURIComponent(encName);
  state.gateStatus[name] = state.gateStatus[name] || {};
  state.gateStatus[name][i] = value;
  rerender('mustHaves', 'report');
}

function renderMustHaves() {
  const th = state.mustHaveDefaults || { met: 4, notMet: 1.5 };
  const s = state.settings, ps = filteredProducts(), as = visibleAreas(), sp = new Set(s.selectedGateProducts || []), sa = new Set(s.selectedGateAreas || []);
  const tot = ps.reduce((a, p) => { const g = mustHaveSummary(p.name); a.p += g.pass; a.f += g.fail; a.u += g.unknown; return a; }, { p: 0, f: 0, u: 0 });
  const options = v => MUST_HAVE_VALUES.map(x => `<option value="${x}" ${x === v ? 'selected' : ''}>${mustHaveLabel(x)}</option>`).join('');

  const toolbar = `<div class="gate-toolbar no-print"><label>Product<input value="${esc(s.gateProductFilter || '')}" onchange="PB.mhFilter('gateProductFilter',this.value)"></label><label>Status<select onchange="PB.mhFilter('gateStatusFilter',this.value)">${STATE_FILTERS.map(([v, l]) => `<option value="${v}" ${v === s.gateStatusFilter ? 'selected' : ''}>${l}</option>`).join('')}</select></label><label>Area<select onchange="PB.mhFilter('gateAreaFilter',this.value)"><option value="All">All</option>${state.gates.map(g => `<option ${g.area === s.gateAreaFilter ? 'selected' : ''}>${esc(g.area)}</option>`).join('')}</select></label><div class="gate-actions"><button class="btn" type="button" onclick="PB.mhSelectRows(true)">Select visible rows</button><button class="btn" type="button" onclick="PB.mhSelectCols(true)">Select visible columns</button><button class="btn" type="button" onclick="PB.mhClear()">Clear</button></div></div>`
    + `<div class="gate-actions no-print"><b>Apply to selected:</b>${MUST_HAVE_VALUES.map(v => `<button class="btn ${v === 'Fail' ? 'danger' : ''}" type="button" onclick="PB.mhBulk('${v}')">${mustHaveLabel(v)}</button>`).join('')}<button class="btn" type="button" onclick="PB.exportMustHavesCSV()">Export must-haves</button></div>`;

  const matrix = `<div class="matrix-wrap"><table class="matrix"><thead><tr><th class="gate-select-cell"><input class="compact-check" type="checkbox" aria-label="Select all visible rows" onchange="PB.mhSelectRows(this.checked)"></th><th>Offering</th>${as.map(x => `<th><input class="compact-check" type="checkbox" aria-label="Select ${esc(x.g.area)}" ${sa.has(x.i) ? 'checked' : ''} onchange="PB.mhToggleCol(${x.i},this.checked)"><br>${esc(x.g.area)}</th>`).join('')}</tr></thead><tbody>${ps.map(p => `<tr class="${sp.has(p.name) ? 'gate-selected' : ''}"><td class="gate-select-cell"><input class="compact-check" type="checkbox" aria-label="Select ${esc(p.name)}" ${sp.has(p.name) ? 'checked' : ''} onchange="PB.mhToggleRow('${enc(p.name)}',this.checked)"></td><td><b>${esc(p.name)}</b></td>${as.map(x => `<td><select aria-label="${esc(p.name)} ${esc(x.g.area)}" onchange="PB.mhSet('${enc(p.name)}',${x.i},this.value)">${options((state.gateStatus[p.name] || {})[x.i] || 'Unknown')}</select></td>`).join('')}</tr>`).join('')}</tbody></table></div>`;

  $('mustHaves').innerHTML = `<div class="card"><h2>Must-haves</h2><ul class="explain explain-list"><li>Non-negotiable requirements, checked before scores matter.</li><li><b>Defaults</b> come from the criterion scores behind each must-have: Met when the weakest is ${n(th.met)}+, Not met at ${n(th.notMet)} or below, Not checked in between. Not applicable when the product's scope caps every one of those criteria.</li><li><b>Bulk edit:</b> filter, select rows and columns, then apply a status to their intersection.</li></ul><div class="coverage-kpi"><div><b>${tot.p}</b>met</div><div><b>${tot.f}</b>not met</div><div><b>${tot.u}</b>not checked or N/A</div><div><b>${ps.length}</b>products visible</div></div>${toolbar}${matrix}</div>`
    + `<div class="card"><h2>What counts as evidence</h2><table><thead><tr><th>Area</th><th>Required evidence</th></tr></thead><tbody>${state.gates.map(g => `<tr><td>${esc(g.area)}</td><td>${esc(g.evidence)}</td></tr>`).join('')}</tbody></table></div>${sessionNote()}`;
}

registerView('mustHaves', renderMustHaves);
expose({ mhFilter: setFilter, mhToggleRow: toggleRow, mhToggleCol: toggleCol, mhSelectRows: selectRows, mhSelectCols: selectCols, mhClear: clearSelection, mhBulk: bulkSet, mhSet: setOne });
