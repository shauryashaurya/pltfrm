// Risk, readiness and value views: capability-vs-risk scatter, sortable per-product risk table, buyer readiness and schedule/value bars
import { state } from '../core/state.js';
import { esc, enc, n, money } from '../core/format.js';
import { benefits, buyerReadinessScore, displayValue, riskScore, RISK_MEASURES, productOptions } from '../core/scoring.js';
import { RISK_COLUMNS, riskRows } from '../core/analysis.js';
import { rerender } from '../core/registry.js';
import { expose } from '../core/actions.js';
import { chartSlot, base, valueAxis, categoryAxis, scaledAxis } from './echarts.js';
import { shortLabel, scaledValueAxis, scaleNote } from './scatter.js';

const level = v => v >= 4 ? 'high' : v >= 2.5 ? 'med' : 'low';
const names = list => list.map(r => r.name);

// Hover text for one product's risk overlay
function riskTip(r) {
  const k = r.risk, months = +k.p50Months ? `<br>Delivery P50/P90 ${n(k.p50Months)}/${n(k.p90Months || k.p50Months)} months` : '';
  return `<b>${esc(r.name)}</b><br>Composite ${n(displayValue(r))}<br>Delivery uncertainty ${n(+k.deliveryUncertainty || 0)}<br>Concentration/lock-in ${n(+k.concentrationRisk || 0)}<br>Buyer-readiness dependency ${n(+k.buyerReadinessDependency || 0)}<br>Combined risk ${n(riskScore(r, 'combined'))}${months}${k.notes ? '<br>' + esc(k.notes) : ''}`;
}

// Capability (x) against the chosen risk measure (y, low risk at the top); top-right is the strongest, safest position
export function riskScatter(rows) {
  const s = state.settings, measure = s.riskMeasure || 'combined', chosen = rows.slice(0, 24), th = +s.shortlistThreshold || 0, mode = s.scaleRisk || 'fit';
  const raw = chosen.map(r => ({ r, x: displayValue(r), y: riskScore(r, measure) }));
  const sx = scaledAxis(raw.map(p => p.x), mode, [0, 100]), sy = scaledAxis(raw.map(p => p.y), mode, [0, 5]);
  // Risk values are often whole numbers, so products land on the same spot; fan exact duplicates sideways so each stays hoverable
  const seen = {}, xSpan = (sx.axis.max - sx.axis.min) || 100;
  const pts = raw.map(p => { const x = sx.map(p.x), y = sy.map(p.y), k = `${x.toFixed(1)}|${y.toFixed(2)}`; seen[k] = (seen[k] || 0) + 1; return { ...p, px: x, py: y, k, nth: seen[k] - 1 }; });
  pts.forEach(p => { const tot = seen[p.k]; p.px += (p.nth - (tot - 1) / 2) * xSpan * .012; });
  // Reference lines only where they are meaningful on the chosen scale
  const lines = mode === 'rank' ? [] : [{ xAxis: th }, { yAxis: 2.5 }].filter(l => l.xAxis === undefined ? l.yAxis >= sy.axis.min && l.yAxis <= sy.axis.max : l.xAxis >= sx.axis.min && l.xAxis <= sx.axis.max);
  const corners = [['Weaker, lower risk', { left: 72, top: 26 }], ['Strong, lower risk', { right: 36, top: 26 }], ['Weaker, higher risk', { left: 72, bottom: 66 }], ['Strong, higher risk', { right: 36, bottom: 66 }]];
  const build = t => base(t, {
    grid: { left: 64, right: 28, top: 20, bottom: 58 },
    xAxis: scaledValueAxis(t, sx, { name: `${s.showEvidenceAdjusted ? 'Evidence-adjusted' : 'Raw'} composite →`, nameLocation: 'middle', nameGap: 34 }),
    yAxis: scaledValueAxis(t, sy, { inverse: true, name: `${RISK_MEASURES[measure]} (low at top)`, nameLocation: 'middle', nameGap: 40 }),
    tooltip: { trigger: 'item', formatter: p => p.seriesType === 'scatter' ? riskTip(pts[p.dataIndex].r) : '' },
    graphic: corners.map(([text, pos]) => ({ type: 'text', ...pos, silent: true, style: { text, fill: t.muted, fontSize: 11 } })),
    series: [{
      type: 'scatter', symbolSize: 13,
      data: pts.map((p, i) => ({ value: [+p.px.toFixed(2), +p.py.toFixed(2)], itemStyle: { color: t.series[i % t.series.length], opacity: .9, borderColor: t.surface, borderWidth: 1.5 } })),
      label: { show: true, position: 'right', distance: 6, formatter: p => shortLabel(pts[p.dataIndex].r.name), color: t.text, fontSize: 11, textBorderColor: t.surface, textBorderWidth: 3 },
      labelLayout: { hideOverlap: true, moveOverlap: 'shiftY' },
      emphasis: { scale: 1.3, label: { show: true, fontWeight: 800 } },
      markLine: { silent: true, symbol: 'none', label: { show: false }, lineStyle: { color: t.lineStrong, type: 'dashed', width: 1 }, data: lines }
    }]
  });
  const notes = [mode === 'rank' ? '' : `Dashed lines: shortlist threshold (${n(th)}) and moderate risk (2.5), where in range.`, scaleNote(mode), 'Crowded labels are hidden; hover a marker for all risk values.'].filter(Boolean);
  return `${chartSlot('risk-scatter', build, 420)}<ul class="chart-notes">${notes.map(x => `<li>${x}</li>`).join('')}</ul>`;
}

// Sorting, filtering and hiding rows of the risk table
function riskSort(key) {
  const s = state.settings;
  if (s.riskSortKey === key) s.riskSortDir = s.riskSortDir === 'asc' ? 'desc' : 'asc';
  else { s.riskSortKey = key; s.riskSortDir = key === 'name' ? 'asc' : 'desc'; }
  rerender('report');
}
function riskHide(encName) { const s = state.settings, x = new Set(s.riskHidden || []); x.add(decodeURIComponent(encName)); s.riskHidden = [...x]; rerender('report'); }
expose({ riskSort, riskHide });

// Risk table: every included product (after the filter), each risk cell shaded by level; click a header to sort by it.
// The focus product row is highlighted so its position in each ordering is easy to follow.
export function riskProfiles(rows) {
  const s = state.settings, { list, col, dir, hidden } = riskRows(rows);
  const arrow = k => k === col[0] ? (dir > 0 ? ' &uarr;' : ' &darr;') : '';
  const cell = v => `<td class="num rk-${level(v)}">${n(v)}</td>`;
  const head = RISK_COLUMNS.map(([k, label]) => `<th${k === 'name' ? '' : ' class="num"'}><button class="sort-head${k === col[0] ? ' on' : ''}" type="button" onclick="PB.riskSort('${k}')" aria-label="Sort by ${label}">${label}${arrow(k)}</button></th>`).join('') + '<th class="no-print"></th>';
  const body = list.map(r => {
    const k = r.risk, months = +k.p50Months ? `${n(k.p50Months)} / ${n(k.p90Months || k.p50Months)}` : '-';
    return `<tr class="${r.name === s.focusProduct ? 'row-focus' : ''}"><td><b>${esc(r.name)}</b></td><td class="num">${n(displayValue(r))}</td>${cell(riskScore(r, 'deliveryUncertainty'))}${cell(riskScore(r, 'concentrationRisk'))}${cell(riskScore(r, 'buyerReadinessDependency'))}${cell(riskScore(r, 'combined'))}<td class="num">${months}</td><td class="no-print"><button class="linkish" type="button" title="Hide this row" aria-label="Hide ${esc(r.name)}" onclick="PB.riskHide('${enc(r.name)}')">&times;</button></td></tr>`;
  }).join('');
  const controls = `<div class="viz-controls no-print"><label>Highlight<select onchange="PB.setView('focusProduct',this.value)">${productOptions(s.focusProduct)}</select></label><label>Filter by name<input value="${esc(s.riskFilter || '')}" placeholder="e.g. spark, ray" onchange="PB.setView('riskFilter',this.value)"></label>${hidden.length ? `<button class="btn" type="button" onclick="PB.setView('riskHidden',[])">Show ${hidden.length} hidden</button>` : ''}</div>`;
  return `${controls}<div class="chart-legend"><span><i style="background:var(--good-bg)"></i>Low (under 2.5)</span><span><i style="background:var(--warn-bg)"></i>Medium</span><span><i style="background:var(--bad-bg)"></i>High (4+)</span></div><div class="matrix-wrap"><table class="risk-table"><thead><tr>${head}</tr></thead><tbody>${body || '<tr><td colspan="8">No products match the filter.</td></tr>'}</tbody></table></div><p class="chart-note">${list.length} of ${rows.length} products. Sorted by ${col[1].toLowerCase()}, ${dir > 0 ? 'ascending' : 'descending'}.</p>`;
}

// Buyer readiness rubric as bars; the weakest weighted items are flagged because they limit every option
export function readinessChart() {
  const b = state.buyerReadiness, gaps = b.criteria.map(c => ({ id: c.id, gap: (5 - (+b.scores[c.id] || 0)) * (+c.weight || 0) })).sort((p, q) => q.gap - p.gap).slice(0, 3).filter(g => g.gap > 0).map(g => g.id);
  const score = buyerReadinessScore(), list = b.criteria;
  const build = t => base(t, {
    grid: { left: 8, right: 36, top: 4, bottom: 24, containLabel: true },
    xAxis: valueAxis(t, { min: 0, max: 5, interval: 1 }),
    yAxis: categoryAxis(t, list.map(c => c.name), { inverse: true, axisLabel: { color: t.text, fontSize: 11, width: 200, overflow: 'truncate', formatter: (v, i) => gaps.includes(list[i].id) ? `{g|${v}}` : v, rich: { g: { fontWeight: 900, fontSize: 11, color: t.text } } } }),
    tooltip: { trigger: 'item', formatter: p => { const c = list[p.dataIndex]; return `<b>${esc(c.name)}</b><br>${esc(c.description || '')}<br>Score ${n(p.value)} of 5; weight ${n(c.weight)}%${gaps.includes(c.id) ? '<br>One of the three largest weighted gaps' : ''}`; } },
    series: [{ type: 'bar', barCategoryGap: '35%', data: list.map(c => { const v = +b.scores[c.id] || 0; return { value: v, itemStyle: { color: v >= 4 ? t.green : v >= 2.5 ? t.amber : t.red } }; }), label: { show: true, position: 'right', formatter: p => n(p.value), color: t.text, fontSize: 11 } }]
  });
  return `<div class="metric"><b class="risk-${score >= 70 ? 'low' : score >= 50 ? 'med' : 'high'}">${n(score)}</b><span>/100 buyer readiness</span></div>${chartSlot('readiness', build, 36 + list.length * 28)}<div class="chart-note">Bold items are the three largest weighted gaps. Readiness describes your organization, not the products, and applies to every option.</div>`;
}

// Delivery P50-P90 ranges and benefit vs TCO, for products where editors entered those inputs
export function scheduleValueChart(rows) {
  const sched = rows.filter(r => +r.risk.p50Months > 0), valued = rows.map(r => ({ r, v: benefits(r.name) })).filter(x => x.v.enabled);
  let out = '';
  if (sched.length) {
    const span = r => { const p50 = +r.risk.p50Months; return [p50, Math.max(p50, +r.risk.p90Months || p50)]; };
    const build = t => base(t, {
      grid: { left: 8, right: 70, top: 4, bottom: 24, containLabel: true },
      xAxis: valueAxis(t, { min: 0, axisLabel: { color: t.muted, fontSize: 11, formatter: '{value} mo' } }),
      yAxis: categoryAxis(t, names(sched), { inverse: true, axisLabel: { color: t.text, fontSize: 11, width: 150, overflow: 'truncate' } }),
      tooltip: { trigger: 'item', formatter: p => riskTip(sched[p.dataIndex]) },
      series: [
        { type: 'bar', stack: 'sched', data: sched.map(r => span(r)[0]), itemStyle: { color: 'transparent' }, silent: true, tooltip: { show: false }, barCategoryGap: '40%' },
        { type: 'bar', stack: 'sched', data: sched.map(r => Math.max(0.3, span(r)[1] - span(r)[0])), itemStyle: { color: t.blue }, label: { show: true, position: 'right', formatter: p => { const [a, z] = span(sched[p.dataIndex]); return `${n(a)}-${n(z)} mo`; }, color: t.text, fontSize: 11 } }
      ]
    });
    out += `<h3>Delivery schedule</h3><div class="chart-note">Bar spans P50 to P90 months</div>${chartSlot('schedule', build, 40 + sched.length * 32)}`;
  }
  if (valued.length) {
    const tip = ({ r, v }) => `<b>${esc(r.name)}</b><br>Gross benefit ${money(v.gross)}<br>Risk-adjusted benefit ${money(v.riskAdjusted)}<br>TCO ${money(r.cost.total || 0)}<br>Net ${money(v.net)}<br>ROI ${v.roi == null ? 'n/a' : n(v.roi) + '%'}<br>Payback ${v.payback == null ? 'not reached' : n(v.payback) + ' months'}`;
    const build = t => base(t, {
      grid: { left: 8, right: 70, top: 4, bottom: 24, containLabel: true },
      xAxis: valueAxis(t, { min: 0, axisLabel: { color: t.muted, fontSize: 11, formatter: v => money(v) } }),
      yAxis: categoryAxis(t, valued.map(x => x.r.name), { inverse: true, axisLabel: { color: t.text, fontSize: 11, width: 150, overflow: 'truncate' } }),
      tooltip: { trigger: 'axis', axisPointer: { type: 'shadow' }, formatter: ps => tip(valued[ps[0].dataIndex]) },
      series: [
        { name: 'Risk-adjusted benefit', type: 'bar', data: valued.map(x => x.v.riskAdjusted), itemStyle: { color: t.green }, barGap: '10%', barCategoryGap: '30%', label: { show: true, position: 'right', formatter: p => { const roi = valued[p.dataIndex].v.roi; return roi == null ? '' : `ROI ${n(roi)}%`; }, color: t.text, fontSize: 11 } },
        { name: 'TCO', type: 'bar', data: valued.map(x => x.r.cost.total || 0), itemStyle: { color: t.amber } }
      ]
    });
    out += `<h3 class="gap">Benefit versus cost</h3><div class="chart-legend"><span><i style="background:var(--c-green)"></i>Risk-adjusted benefit</span><span><i style="background:var(--c-amber)"></i>${state.settings.costYears}-yr TCO</span></div>${chartSlot('value', build, 40 + valued.length * 44)}`;
  }
  return out || `<div class="explain"><b>No schedule or value inputs yet.</b> Editors can add P50/P90 delivery months under <b>Must-haves, cost, risk &gt; Risk and readiness</b>, and benefits with a cost model under <b>Cost, TCO and value</b>. Products with those inputs then appear here with P50-P90 ranges, risk-adjusted benefit against TCO, ROI and payback.</div>`;
}
