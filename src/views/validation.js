// Validation plan: filterable list of tests and evidence needed to replace baseline scores
import { state } from '../core/state.js';
import { $, esc } from '../core/format.js';
import { registerView } from '../core/registry.js';
import { expose } from '../core/actions.js';

function validationTable(rows) {
  const keys = Object.keys(rows[0] || {});
  return `<table class="comparison-table"><thead><tr>${keys.map(k => `<th>${esc(k)}</th>`).join('')}</tr></thead><tbody>${rows.map(r => `<tr>${keys.map(k => `<td>${esc(r[k])}</td>`).join('')}</tr>`).join('')}</tbody></table>`;
}

// Filtering only redraws the table body, so the select keeps focus
function filterValidation(area) { $('validationRows').innerHTML = validationTable((state.validationPlan || []).filter(r => !area || r.Area === area)); }

function renderValidation() {
  const rows = state.validationPlan || [], areas = [...new Set(rows.map(r => r.Area))].sort();
  $('validation').innerHTML = `<div class="card"><h2>Validation and vetting plan</h2><div class="explain"><b>Use:</b> replace baseline public-evidence scores with dated test results, current assurance material, contractual commitments and reference evidence. Preserve environment, scale, configuration, owner, reviewer and date.</div><div class="viz-controls no-print"><label>Filter area<select id="validationArea" onchange="PB.filterValidation(this.value)"><option value="">All areas</option>${areas.map(a => `<option>${esc(a)}</option>`).join('')}</select></label><button class="btn editor-only" type="button" onclick="PB.exportValidationCSV()">Export validation CSV</button></div><div id="validationRows" class="matrix-wrap page-flow">${validationTable(rows)}</div></div>`
    + `<div class="card"><h2>Evidence capture template</h2><p>For each changed score or must-have marked Met, record: offering; criterion/must-have; claim; evidence type; source; evidence date; tested edition/region/deployment; environment and data volume; test result; owner; independent reviewer; confidence before/after; exception or compensating control; approval decision.</p></div>`;
}

registerView('validation', renderValidation);
expose({ filterValidation });
