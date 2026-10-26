// Edit scores: criterion score matrix per dimension with provenance tags
import { state } from '../core/state.js';
import { $, esc, enc, n } from '../core/format.js';
import { dims, scoreMeta, statusClass, scoreCoverage } from '../core/scoring.js';
import { registerView, rerender } from '../core/registry.js';
import { expose } from '../core/actions.js';

// Filter and dimension live in the panel itself, so read them back before re-rendering
let scoreDim = 'technical', scoreQuery = '';

function setScoreFilter() { scoreDim = $('scoreDim').value; scoreQuery = $('scoreSearch').value; rerender('scores'); const s = $('scoreSearch'); if (s) { s.focus(); s.setSelectionRange(s.value.length, s.value.length); } }

// A typed score is marked user-provided; clearing it marks the cell as needing input
function setScore(encName, dim, encId, v) {
  const name = decodeURIComponent(encName), cid = decodeURIComponent(encId);
  state.scores[name][dim][cid] = v === '' ? null : Math.max(0, Math.min(5, +v));
  state.scoreStatus[name] = state.scoreStatus[name] || {};
  state.scoreStatus[name][dim] = state.scoreStatus[name][dim] || {};
  const m = scoreMeta(name, dim, cid);
  state.scoreStatus[name][dim][cid] = { ...m, status: v === '' ? 'User input required' : 'User-provided - validate', source: 'User entry', updated: new Date().toISOString().slice(0, 10) };
  rerender('report', 'comparison');
}

function renderScores() {
  const cs = state.criteria[scoreDim], q = scoreQuery.toLowerCase(), ps = state.products.filter(p => !p.hidden && p.name.toLowerCase().includes(q)), cov = scoreCoverage();
  const cell = (p, c) => {
    const v = state.scores[p.name]?.[scoreDim]?.[c.id], m = scoreMeta(p.name, scoreDim, c.id);
    return `<td class="score-cell"><input class="${v == null ? 'missing-score' : ''}" type="number" min="0" max="5" step=".1" value="${v == null ? '' : v}" title="${esc(m.rationale)}" aria-label="${esc(p.name)} ${esc(c.name)}" onchange="PB.setScore('${enc(p.name)}','${scoreDim}','${enc(c.id)}',this.value)"><span class="status-tag ${statusClass(m.status)}" title="${esc(m.rationale)}">${esc(m.status)}</span></td>`;
  };
  $('scores').innerHTML = `<div class="card"><h2>Editable criterion scores and provenance</h2><div class="explain"><b>Coverage:</b> every packaged product has a score for every current criterion. Status tags distinguish a directional packaged baseline from criteria that require workload, buyer, organization or scenario-specific input. A visible score tagged "User input required" is only a placeholder baseline and must be replaced before a decision.</div><div class="coverage-kpi"><div><b>${cov.total}</b>visible product-criterion cells</div><div><b>${cov.missing}</b>blank scores</div><div><b>${cov.user}</b>user-input-required cells</div><div><b>${cov.validate}</b>baseline cells to validate</div></div><div class="status-legend"><span class="status-tag st-base">Baseline - validate</span><span class="status-tag st-workload">Workload validation</span><span class="status-tag st-cost">Buyer cost validation</span><span class="status-tag st-user">User input required</span></div><div class="form-row"><label for="scoreDim">Dimension</label><select id="scoreDim" onchange="PB.setScoreFilter()">${Object.keys(dims).map(d => `<option value="${d}" ${d === scoreDim ? 'selected' : ''}>${dims[d]}</option>`).join('')}</select></div><input id="scoreSearch" class="search" placeholder="Filter products" aria-label="Filter products" value="${esc(scoreQuery)}" oninput="PB.setScoreFilter()"><div class="matrix-wrap"><table class="matrix"><thead><tr><th>Offering</th>${cs.map(c => `<th title="${esc(c.description)}">${esc(c.name)}<br><small>${n(c.weight)}%</small></th>`).join('')}</tr></thead><tbody>${ps.map(p => `<tr><td><b>${esc(p.name)}</b><br><small>${esc(p.category)}</small></td>${cs.map(c => cell(p, c)).join('')}</tr>`).join('')}</tbody></table></div></div>`
    + `<div class="card"><h2>Score-status definitions</h2><table class="provenance-table"><thead><tr><th>Status</th><th>Meaning</th><th>Required action</th></tr></thead><tbody><tr><td>Baseline - validate</td><td>Directional packaged score based on assessed product scope.</td><td>Replace or confirm with current documentation, demonstrations, references and contract evidence.</td></tr><tr><td>Baseline - workload validation required</td><td>Architecture or performance depends on the target workload and deployment.</td><td>Run matched-volume, concurrency, policy and failure tests.</td></tr><tr><td>Baseline - buyer cost validation required</td><td>Economic favorability is directional.</td><td>Enter implementation, integration, staffing, consumption, change and exit evidence; use Cost, TCO and value.</td></tr><tr><td>User scenario input required</td><td>Domain fit cannot be a universal market score.</td><td>Rescore for the named industry, workflow, data, controls and use case.</td></tr><tr><td>User organization input required</td><td>Adoption/value depends on the buyer.</td><td>Rescore with target users, process owners, change plan, KPI baseline and benefit model.</td></tr></tbody></table></div>`;
}

registerView('scores', renderScores);
expose({ setScore, setScoreFilter });
