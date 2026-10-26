// Risk, readiness and value views: capability-vs-risk scatter, per-product risk matrix, buyer readiness and schedule/value bars
import { state } from '../core/state.js';
import { esc, n, money } from '../core/format.js';
import { benefits, buyerReadinessScore, displayValue, riskScore, RISK_MEASURES } from '../core/scoring.js';
import { chartSlot, base, valueAxis, categoryAxis } from './echarts.js';
import { shortLabel } from './scatter.js';

const level = v => v >= 4 ? 'high' : v >= 2.5 ? 'med' : 'low';
const levelColor = (t, v) => ({ low: t.green, med: t.amber, high: t.red })[level(v)];
const names = list => list.map(r => r.name);

// Hover text for one product's risk overlay
function riskTip(r) {
  const k = r.risk, months = +k.p50Months ? `<br>Delivery P50/P90 ${n(k.p50Months)}/${n(k.p90Months || k.p50Months)} months` : '';
  return `<b>${esc(r.name)}</b><br>6D ${n(displayValue(r))}<br>Delivery uncertainty ${n(+k.deliveryUncertainty || 0)}<br>Concentration/lock-in ${n(+k.concentrationRisk || 0)}<br>Buyer-readiness dependency ${n(+k.buyerReadinessDependency || 0)}<br>Combined risk ${n(riskScore(r, 'combined'))}${months}${k.notes ? '<br>' + esc(k.notes) : ''}`;
}

// Capability (x) against the chosen risk measure (y, low risk at the top); top-right is the strongest, safest position
export function riskScatter(rows) {
  const measure = state.settings.riskMeasure || 'combined', chosen = rows.slice(0, 24), th = +state.settings.shortlistThreshold || 0;
  // Risk values are often whole numbers, so products land on the same spot; fan exact duplicates slightly so each stays hoverable
  const seen = {};
  const pts = chosen.map(r => { const x = displayValue(r), y = riskScore(r, measure), k = `${x.toFixed(0)}|${y.toFixed(2)}`; seen[k] = (seen[k] || 0) + 1; return { r, x, y, k, nth: seen[k] - 1 }; });
  pts.forEach(p => { const tot = seen[p.k]; p.x += (p.nth - (tot - 1) / 2) * 0.7; });
  const corners = [['Weaker, lower risk', { left: 72, top: 26 }], ['Strong, lower risk', { right: 36, top: 26 }], ['Weaker, higher risk', { left: 72, bottom: 66 }], ['Strong, higher risk', { right: 36, bottom: 66 }]];
  const build = t => base(t, {
    grid: { left: 64, right: 28, top: 20, bottom: 58 },
    xAxis: valueAxis(t, { min: 0, max: 100, interval: 25, name: `${state.settings.showEvidenceAdjusted ? 'Evidence-adjusted' : 'Raw'} 6D score →`, nameLocation: 'middle', nameGap: 34 }),
    yAxis: valueAxis(t, { min: 0, max: 5, interval: 1, inverse: true, name: `${RISK_MEASURES[measure]} (0 low, top)`, nameLocation: 'middle', nameGap: 36 }),
    tooltip: { trigger: 'item', formatter: p => p.seriesType === 'scatter' ? riskTip(pts[p.dataIndex].r) : '' },
    graphic: corners.map(([text, pos]) => ({ type: 'text', ...pos, silent: true, style: { text, fill: t.muted, fontSize: 11 } })),
    series: [{
      type: 'scatter', symbolSize: 13,
      data: pts.map((p, i) => ({ value: [+p.x.toFixed(2), +p.y.toFixed(2)], itemStyle: { color: t.series[i % t.series.length], opacity: .9, borderColor: t.surface, borderWidth: 1.5 } })),
      label: { show: true, position: 'right', distance: 6, formatter: p => shortLabel(pts[p.dataIndex].r.name), color: t.text, fontSize: 11, textBorderColor: t.surface, textBorderWidth: 3 },
      labelLayout: { hideOverlap: true, moveOverlap: 'shiftY' },
      emphasis: { scale: 1.3, label: { show: true, fontWeight: 800 } },
      markLine: { silent: true, symbol: 'none', label: { show: false }, lineStyle: { color: t.lineStrong, type: 'dashed', width: 1 }, data: [{ xAxis: th }, { yAxis: 2.5 }] }
    }]
  });
  return `${chartSlot('risk-scatter', build, 420)}<div class="chart-note">The vertical line is the shortlist threshold (${n(th)}); the horizontal line is moderate risk (2.5). Crowded labels are hidden; hover any marker for all three risk values and notes.</div>`;
}

// Risk matrix: products as rows, the three risks plus their mean as columns, each cell coloured by level
export function riskProfiles(rows) {
  const list = (state.settings.riskSort === 'risk' ? rows.slice().sort((a, b) => riskScore(b, 'combined') - riskScore(a, 'combined')) : rows).slice(0, 12);
  const cols = [['deliveryUncertainty', 'Delivery'], ['concentrationRisk', 'Lock-in'], ['buyerReadinessDependency', 'Readiness dep.'], ['combined', 'Combined']];
  const data = list.flatMap((r, yi) => cols.map(([k], xi) => [xi, yi, +riskScore(r, k).toFixed(2)]));
  const build = t => base(t, {
    grid: { left: 8, right: 8, top: 8, bottom: 8, containLabel: true },
    xAxis: categoryAxis(t, cols.map(c => c[1]), { position: 'top', axisLine: { show: false }, axisLabel: { interval: 0, color: t.muted, fontSize: 11, fontWeight: 700 } }),
    yAxis: categoryAxis(t, names(list), { inverse: true, axisLine: { show: false }, axisLabel: { color: t.text, fontSize: 11, width: 150, overflow: 'truncate' } }),
    visualMap: { show: false, type: 'piecewise', dimension: 2, pieces: [{ lt: 2.5, color: t.green }, { gte: 2.5, lt: 4, color: t.amber }, { gte: 4, color: t.red }] },
    tooltip: { trigger: 'item', formatter: p => riskTip(list[p.value[1]]) },
    series: [{ type: 'heatmap', data, itemStyle: { borderColor: t.surface, borderWidth: 3 }, label: { show: true, color: '#2B2622', fontSize: 11, fontWeight: 800, formatter: p => n(p.value[2]) } }]
  });
  return `<div class="chart-legend"><span><i style="background:var(--c-green)"></i>Low (under 2.5)</span><span><i style="background:var(--c-amber)"></i>Medium</span><span><i style="background:var(--c-red)"></i>High (4+)</span></div>${chartSlot('risk-matrix', build, 46 + list.length * 30)}`;
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
