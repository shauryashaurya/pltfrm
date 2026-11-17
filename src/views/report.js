// Live report: scope filter, summary, executive comparison, insight charts, decision tables, must-haves, method and a closing note
import { state } from '../core/state.js';
import { $, esc, enc, n, money, bar } from '../core/format.js';
import { allResults, dims, DIMENSIONS, product, status, productOptions, categoryOptions, displayValue, RISK_MEASURES } from '../core/scoring.js';
import { criterionComparison } from '../core/analysis.js';
import { registerView, rerender, renderAll } from '../core/registry.js';
import { expose } from '../core/actions.js';
import { mustHaveLabel, SCOPES } from '../config.js';
import { radarChart, profileTable } from '../charts/radar.js';
import { scatterSVG, economicsScatter, scaleControl } from '../charts/scatter.js';
import { riskChart, mustHaveChart, tcoChart } from '../charts/bars.js';
import { criterionHeatmap, tradeoffChart, differentiators } from '../charts/criteria.js';
import { riskScatter, riskProfiles, readinessChart, scheduleValueChart } from '../charts/risk.js';

// Report-only view settings (chart selections) change state.settings and redraw the report.
// The scope filter changes which products every panel and the rail rank, so it redraws everything.
function setView(key, value) { state.settings[key] = value; if (key === 'scopeFilter') renderAll(); else rerender('report'); }

// Criterion comparison: add or remove one product (starting from the products currently shown), at most 10
function toggleHeatProduct(encName) {
  const name = decodeURIComponent(encName), shown = new Set(criterionComparison(allResults()).chosen.map(r => r.name));
  shown.has(name) ? shown.delete(name) : shown.size < 10 && shown.add(name);
  state.settings.heatmapProducts = [...shown];
  rerender('report');
}

const dimOptions = (selected, withAll) => (withAll ? `<option value="all" ${selected === 'all' ? 'selected' : ''}>All dimensions</option>` : '') + Object.keys(dims).map(d => `<option value="${d}" ${d === selected ? 'selected' : ''}>${dims[d]}</option>`).join('');
const bullets = items => `<ul class="explain explain-list">${items.map(x => `<li>${x}</li>`).join('')}</ul>`;

// Full results table shared by the report
export function resultsTable(rows) {
  return `<div class="matrix-wrap"><table><thead><tr><th>Offering</th><th>Scope</th><th>Category</th>${DIMENSIONS.map(d => `<th>${esc(d.column)}</th>`).join('')}<th>Composite</th><th>Confidence</th><th>Adjusted</th><th>${state.settings.costYears}-yr TCO</th><th>Risk D/C/R</th><th>Must-haves met/not met/unchecked</th><th>Status</th></tr></thead><tbody>${rows.map(r => `<tr><td><b>${esc(r.name)}</b></td><td>${esc(r.scope)}</td><td>${esc(r.category)}</td>${DIMENSIONS.map(d => `<td class="num">${n(r[d.letter])}</td>`).join('')}<td class="num score">${n(r.c)}</td><td>${r.confidence}</td><td class="num">${n(r.adjusted)}</td><td class="num">${r.cost.enabled ? money(state.settings.tcoMode === 'npv' ? r.cost.npv : r.cost.total) : 'Not modeled'}</td><td class="num">${n(r.risk.deliveryUncertainty || 0)}/${n(r.risk.concentrationRisk || 0)}/${n(r.risk.buyerReadinessDependency || 0)}</td><td class="num ${r.gates.fail ? 'gate-fail' : ''}">${r.gates.pass}/${r.gates.fail}/${r.gates.unknown}</td><td>${status(r)}</td></tr>`).join('')}</tbody></table></div>`;
}

// Role, fit and boundary table; the boundary column takes half the width (see .comparison-table)
export function rolesTable(rows, flow) {
  return `<div class="matrix-wrap${flow ? ' page-flow' : ''}"><table class="comparison-table"><thead><tr><th>Offering</th><th>Scope</th><th>Category</th><th>Primary role</th><th>Representative fit</th><th>Boundary / verification need</th><th>Composite</th></tr></thead><tbody>${rows.map(r => `<tr><td><b>${esc(r.name)}</b></td><td>${esc(r.scope)}</td><td>${esc(r.category)}</td><td>${esc(r.role)}</td><td>${esc(r.fit)}</td><td>${esc(r.boundary)}</td><td class="num score">${n(r.c)}</td></tr>`).join('')}</tbody></table></div>`;
}

// Top five candidates with what sets each apart from the field (dimension score vs the mean of included products)
function execSummary(rows) {
  const s = state.settings, ranked = rows.slice().sort((a, b) => displayValue(b) - displayValue(a)), top = ranked.slice(0, 5), lead = top[0];
  if (!lead) return '<div class="card"><h2>Executive summary</h2><p>No products are included.</p></div>';
  const mean = Object.fromEntries(DIMENSIONS.map(d => [d.key, rows.reduce((a, r) => a + r[d.letter], 0) / rows.length]));
  const basis = s.showEvidenceAdjusted ? 'evidence-adjusted composite' : 'raw composite';
  const shortlisted = ranked.filter(r => r.c >= s.shortlistThreshold && !r.gates.fail).length;
  const gap = top[1] ? displayValue(lead) - displayValue(top[1]) : 0, signed = v => (v >= 0 ? '+' : '') + n(v);
  const tiles = top.map((r, i) => {
    const rel = DIMENSIONS.map(d => ({ d: d.column, v: r[d.letter] - mean[d.key] })).sort((a, b) => b.v - a.v), best = rel[0], worst = rel[rel.length - 1];
    return `<div class="exec-tile" data-tip onmousemove="PB.tipProduct(event,'${enc(r.name)}')" onmouseleave="PB.hideTip()"><div class="exec-rank">#${i + 1}</div><div class="exec-name">${esc(r.name)}</div><div class="exec-cat">${esc(r.category)}</div><div class="exec-score"><b>${n(displayValue(r))}</b>${i ? `<span>${n(displayValue(r) - displayValue(lead))} vs #1</span>` : '<span>leader</span>'}</div>${bar(displayValue(r))}<dl><dt>Strongest</dt><dd>${esc(best.d)} <small>${signed(best.v)}</small></dd><dt>Weakest</dt><dd>${esc(worst.d)} <small>${signed(worst.v)}</small></dd></dl></div>`;
  }).join('');
  return `<div class="card exec-summary"><h2>Executive summary</h2><p class="exec-lead"><b>${esc(lead.name)}</b> leads on ${basis} with ${n(displayValue(lead))}${top[1] ? `, ${n(gap)} points ahead of ${esc(top[1].name)}` : ''}. ${shortlisted} of ${rows.length} offerings clear the shortlist threshold (${n(s.shortlistThreshold)}) with no must-have marked not met.</p><div class="exec-grid">${tiles}</div><ul class="chart-notes"><li>Ranked by ${basis}.</li><li>Strongest and weakest: dimensions furthest above and below the mean of the ${rows.length} included offerings (points out of 100).</li><li>Hover a tile for the full breakdown.</li></ul></div>`;
}

// Criterion comparison controls and chart: products come from one offering scope
function criterionCard(rows) {
  const s = state.settings, C = criterionComparison(rows), picked = new Set(C.chosen.map(r => r.name));
  const counts = Object.fromEntries(C.scopes.map(x => [x, rows.filter(r => r.scope === x).length]));
  const chips = C.pool.map(r => `<label class="chip${picked.has(r.name) ? ' on' : ''}"><input type="checkbox" ${picked.has(r.name) ? 'checked' : ''} onchange="PB.toggleHeatProduct('${enc(r.name)}')">${esc(r.name)}</label>`).join('');
  return `<div class="card"><h2>Criterion comparison</h2>${bullets(['Compares products within one offering scope, so engines are not set against full platforms.', 'Pick up to 10 products and a dimension. ★ marks the best score in each row.'])}`
    + `<div class="viz-controls no-print"><label>Scope<select onchange="PB.setView('heatmapScope',this.value)">${C.scopes.map(x => `<option value="${esc(x)}" ${x === C.scope ? 'selected' : ''}>${esc(x)} (${counts[x]})</option>`).join('')}</select></label><label>Dimension<select onchange="PB.setView('heatmapDimension',this.value)">${dimOptions(C.dim)}</select></label><label>View<select onchange="PB.setView('heatmapMode',this.value)"><option value="absolute" ${s.heatmapMode !== 'delta' ? 'selected' : ''}>Score 0-5</option><option value="delta" ${s.heatmapMode === 'delta' ? 'selected' : ''}>Difference from mean of shown</option></select></label></div>`
    + `<div class="chip-row no-print">${chips}</div><p class="chart-note print-only">${esc(C.scope)}: ${C.chosen.map(r => esc(r.name)).join(', ')}</p>${criterionHeatmap(C, s.heatmapMode)}</div>`;
}

// Analytical cards: trade-offs, discriminating criteria, positioning, criterion comparison, build-vs-buy, TCO, risk, evidence
function insightCharts(rows) {
  const s = state.settings;
  return `<div class="card"><h2>Trade-off explorer</h2>${bullets(['Pick a focus product, a benchmark and a dimension.', 'Each bar is one criterion; its label names the product that scores higher and by how much.', 'Domain, adoption and economics criteria are flagged for buyer validation.'])}<div class="viz-controls no-print"><label>Focus product<select onchange="PB.setView('focusProduct',this.value)">${productOptions(s.focusProduct)}</select></label><label>Benchmark<select onchange="PB.setView('benchmarkProduct',this.value)">${productOptions(s.benchmarkProduct)}</select></label><label>Dimension<select onchange="PB.setView('tradeoffDimension',this.value)">${dimOptions(s.tradeoffDimension, true)}</select></label></div>${tradeoffChart(rows)}</div>`
    + `<div class="card"><h2>Most discriminating criteria</h2>${bullets(['Criteria where included products differ most.', 'Each bar names the lowest scorer on the left and the highest on the right.'])}${differentiators(rows)}</div>`
    + `<div class="card"><h2>Technical-business positioning</h2><div class="viz-controls no-print"><label>Product role<select onchange="PB.setView('chartCategory',this.value)">${categoryOptions(s.chartCategory)}</select></label>${scaleControl('scaleTB')}<label><input type="checkbox" ${s.showScatterLabels ? 'checked' : ''} onchange="PB.setView('showScatterLabels',this.checked)"> Show product labels</label></div>${scatterSVG(rows)}</div>`
    + criterionCard(rows)
    + `<div class="card"><h2>Build-vs-buy positioning</h2>${bullets(['Capability (up) against delivery and run economics (right).', 'Suites can cut integration work and still cost more to license; components can cost less to buy and more to integrate and run.'])}<div class="viz-controls no-print">${scaleControl('scaleEcon')}</div>${economicsScatter(rows)}</div>`
    + `<div class="card"><h2>Quantitative TCO comparison</h2><div class="viz-controls no-print"><label>Horizon<input type="number" min="1" max="10" value="${s.costYears}" onchange="PB.setView('costYears',+this.value)"></label><label>View<select onchange="PB.setView('tcoMode',this.value)"><option value="undiscounted" ${s.tcoMode === 'undiscounted' ? 'selected' : ''}>Undiscounted cash TCO</option><option value="npv" ${s.tcoMode === 'npv' ? 'selected' : ''}>Discounted NPV</option></select></label></div>${tcoChart(rows)}</div>`
    + `<div class="card"><h2>Risk, readiness and value realization</h2>${bullets(['Risk runs 0 (low) to 5 (high) and sits beside the composite, not inside it.', '<b>Delivery uncertainty:</b> schedule and scope risk.', '<b>Concentration/lock-in:</b> dependency on one vendor and the cost of leaving.', '<b>Buyer-readiness dependency:</b> reliance on your own data, skills and processes.'])}`
    + `<h3>Capability versus risk</h3><div class="viz-controls no-print"><label>Risk measure<select onchange="PB.setView('riskMeasure',this.value)">${Object.entries(RISK_MEASURES).map(([k, v]) => `<option value="${k}" ${k === (s.riskMeasure || 'combined') ? 'selected' : ''}>${v}</option>`).join('')}</select></label>${scaleControl('scaleRisk')}</div>${riskScatter(rows)}`
    + `<h3 class="gap">Risk profile by product</h3><div class="chart-note">Click a column header to sort by it; the highlighted row is the focus product.</div>${riskProfiles(rows)}`
    + `<div class="insight-grid gap-top"><div class="insight"><h3>Buyer readiness</h3><div class="chart-note">Your organization's starting point; low items slow every option</div>${readinessChart()}</div><div class="insight"><h3>Schedule and value</h3>${scheduleValueChart(rows)}</div></div></div>`
    + `<div class="card"><h2>Evidence and eligibility</h2><div class="insight-grid"><div class="insight"><h3>Evidence impact</h3><div class="chart-note">Raw versus confidence-adjusted composite</div>${riskChart(rows)}</div><div class="insight"><h3>Must-have completeness</h3><div class="chart-note">Met, not met and not checked</div>${mustHaveChart(rows)}</div></div></div>`;
}

function renderReport() {
  const s = state.settings, rows = allResults(), dw = state.dimensionWeights;
  const scope = s.scopeFilter || 'All', included = state.products.filter(p => !p.hidden && (scope === 'All' || p.scope === scope));

  // Scope filter first: ranking engines next to integrated platforms mixes unlike offerings
  const counts = Object.fromEntries(SCOPES.map(x => [x, state.products.filter(p => !p.hidden && p.scope === x).length]));
  const scopeBar = `<div class="card no-print"><div class="viz-controls"><label>Compare within<select onchange="PB.setView('scopeFilter',this.value)"><option value="All">All offerings (${state.products.filter(p => !p.hidden).length})</option>${SCOPES.map(x => `<option value="${esc(x)}" ${x === scope ? 'selected' : ''} ${counts[x] ? '' : 'disabled'}>${esc(x)} (${counts[x]})</option>`).join('')}</select></label></div><div class="chart-note">Pick one offering scope for like-for-like rankings. Every panel below follows this filter.</div></div>`;

  const head = scopeBar + execSummary(rows);

  // Executive comparison: radar of the leading products, beside a table of their dimension scores
  const exec = `<div class="card"><h2>Executive comparison</h2>${bullets(['Each shape is one product; further out scores higher. Hover a shape to isolate it; click a legend name to hide it.', 'Dimension score: criterion-weighted mean, 0-100.', `Composite: weighted ${s.compositeMethod === 'arithmetic' ? 'arithmetic' : 'geometric'} mean of dimension scores.`, 'Evidence-adjusted: composite × confidence factor (A 1.00, B 0.90, C 0.75, D 0.50, E 0.25).'])}<div class="chart-grid"><div>${radarChart(rows)}</div><div><h3>Dimension profile</h3>${profileTable(rows)}</div></div></div>`;

  // Reference tables: decisions, roles, TCO inputs, must-have matrix
  const tables = `<div class="card print-break"><h2>Decision table</h2>${resultsTable(rows)}</div>`
    + `<div class="card"><h2>Product roles, fit and boundaries</h2>${rolesTable(rows)}</div>`
    + `<div class="card print-break"><h2>Complete TCO assumptions</h2><div class="export-note">Zero or disabled means not modeled, not zero cost.</div><div class="matrix-wrap"><table class="tco-assumption-table"><thead><tr><th>Offering</th><th>Enabled</th><th>License</th><th>Cloud</th><th>Support</th><th>Implementation</th><th>Integration</th><th>Run FTE</th><th>Change FTE</th><th>Cash TCO</th><th>NPV</th></tr></thead><tbody>${rows.map(r => { const m = product(r.name)?.costModel || {}; return `<tr><td>${esc(r.name)}</td><td>${m.enabled ? 'Yes' : 'No'}</td><td>${money(m.licenseAnnual || 0)}</td><td>${money(m.cloudAnnual || 0)}</td><td>${money(m.supportAnnual || 0)}</td><td>${money(m.implementationOneTime || 0)}</td><td>${money(m.integrationOneTime || 0)}</td><td>${m.ongoingFTE || 0}</td><td>${m.changeFTE || 0}</td><td>${r.cost.enabled ? money(r.cost.total) : 'Not modeled'}</td><td>${r.cost.enabled ? money(r.cost.npv) : 'Not modeled'}</td></tr>`; }).join('')}</tbody></table></div></div>`
    + `<div class="card print-break"><h2>Must-have status matrix</h2><div class="matrix-wrap"><table class="matrix"><thead><tr><th>Offering</th>${state.gates.map(g => `<th>${esc(g.area)}</th>`).join('')}</tr></thead><tbody>${included.map(p => `<tr><td>${esc(p.name)}</td>${state.gates.map((g, i) => `<td>${esc(mustHaveLabel((state.gateStatus[p.name] || {})[i] || 'Unknown'))}</td>`).join('')}</tr>`).join('')}</tbody></table></div></div>`;

  // Method summary, must-have definitions, validation plan and the closing note (rail.js fills in the open items)
  const vp = state.validationPlan || [], vkeys = Object.keys(vp[0] || {});
  const method = `<div class="card print-break"><h2>Method and verification</h2><ul><li><b>Dimension weights:</b> ${DIMENSIONS.map(d => `${esc(d.column.toLowerCase())} ${n(+dw[d.key] || 0)}`).join('; ')}.</li><li>Criterion weights normalize within each dimension.</li><li>Check must-haves before selection.</li><li>Compare within one offering scope and product role.</li><li>Read criterion trade-offs, domain fit, adoption/value, economics and risk beside the composite.</li><li>Domain-centred platforms such as Salesforce are not general compute substitutes unless the scenario shows that fit.</li><li>Review buyer readiness, P50/P90 schedule and lock-in separately from capability.</li><li>Validate scale with matched volume, concurrency, policy and failure tests.</li><li>Replace public-evidence confidence with dated tests and binding evidence.</li></ul><h3>Must-have definitions</h3><table><thead><tr><th>Must-have</th><th>Required evidence</th></tr></thead><tbody>${state.gates.map(g => `<tr><td>${esc(g.area)}</td><td>${esc(g.evidence)}</td></tr>`).join('')}</tbody></table><h3>Validation plan</h3><table><thead><tr>${vkeys.map(k => `<th>${esc(k)}</th>`).join('')}</tr></thead><tbody>${vp.map(r => `<tr>${Object.values(r).map(v => `<td>${esc(v)}</td>`).join('')}</tr>`).join('')}</tbody></table></div>`
    + `<div class="card" id="reportNote"><h2>Note</h2><div id="reportOpenItems"></div><ul class="page-note"><li>Scores are directional assessments, not audit findings, certifications, benchmarks or price quotes.</li><li>Quantitative TCO reflects the entered assumptions only.</li><li>Confirm edition, deployment, region, availability, assurance scope, contract terms and measured workload behaviour at decision time.</li></ul></div>`;

  $('report').innerHTML = head + exec + insightCharts(rows) + tables + method;
}

registerView('report', renderReport);
expose({ setView, toggleHeatProduct });
