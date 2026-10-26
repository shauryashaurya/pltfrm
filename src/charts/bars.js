// Horizontal bar charts: evidence impact, must-have completeness and quantitative TCO
import { state } from '../core/state.js';
import { esc, n, money } from '../core/format.js';
import { topRows } from '../core/scoring.js';
import { chartSlot, base, valueAxis, categoryAxis } from './echarts.js';

const barHeight = count => 40 + count * 34;
const names = list => list.map(r => r.name);

// Raw composite vs evidence-adjusted composite for the top 10
export function riskChart(rows) {
  const list = topRows(rows);
  const build = t => base(t, {
    grid: { left: 8, right: 44, top: 8, bottom: 24, containLabel: true },
    xAxis: valueAxis(t, { min: 0, max: 100, interval: 25 }),
    yAxis: categoryAxis(t, names(list), { inverse: true, axisLabel: { color: t.text, fontSize: 11, width: 150, overflow: 'truncate' } }),
    tooltip: { trigger: 'axis', axisPointer: { type: 'shadow' }, formatter: ps => `<b>${esc(list[ps[0].dataIndex].name)}</b> (confidence ${list[ps[0].dataIndex].confidence})<br>${ps.map(p => `${p.seriesName} ${n(p.value)}`).join('<br>')}` },
    series: [
      { name: 'Raw 6D', type: 'bar', data: list.map(r => +r.c.toFixed(1)), itemStyle: { color: t.blue }, barGap: '10%', barCategoryGap: '30%' },
      { name: 'Evidence-adjusted', type: 'bar', data: list.map(r => +r.adjusted.toFixed(1)), itemStyle: { color: t.gray }, label: { show: true, position: 'right', formatter: p => n(p.value), color: t.text, fontSize: 11 } }
    ]
  });
  return `<div class="chart-legend"><span><i style="background:var(--c-blue)"></i>Raw 6D</span><span><i style="background:var(--c-gray)"></i>Evidence-adjusted</span></div>${chartSlot('evidence', build, barHeight(list.length) + 60)}`;
}

// Stacked met / not met / not checked share per product
export function mustHaveChart(rows) {
  const list = topRows(rows), share = (r, k) => { const tot = Math.max(1, r.gates.pass + r.gates.fail + r.gates.unknown); return +(100 * r.gates[k] / tot).toFixed(1); };
  const build = t => base(t, {
    grid: { left: 8, right: 16, top: 8, bottom: 24, containLabel: true },
    xAxis: valueAxis(t, { min: 0, max: 100, interval: 25, axisLabel: { color: t.muted, fontSize: 11, formatter: '{value}%' } }),
    yAxis: categoryAxis(t, names(list), { inverse: true, axisLabel: { color: t.text, fontSize: 11, width: 150, overflow: 'truncate' } }),
    tooltip: { trigger: 'axis', axisPointer: { type: 'shadow' }, formatter: ps => { const r = list[ps[0].dataIndex]; return `<b>${esc(r.name)}</b><br>Met ${r.gates.pass}<br>Not met ${r.gates.fail}<br>Not checked ${r.gates.unknown}`; } },
    series: [['pass', 'Met', t.green], ['fail', 'Not met', t.red], ['unknown', 'Not checked', t.amber]].map(([k, name, color]) => ({ name, type: 'bar', stack: 'gates', data: list.map(r => share(r, k)), itemStyle: { color }, barCategoryGap: '35%' }))
  });
  return `<div class="chart-legend"><span><i style="background:var(--c-green)"></i>Met</span><span><i style="background:var(--c-red)"></i>Not met</span><span><i style="background:var(--c-amber)"></i>Not checked</span></div>${chartSlot('musthaves', build, barHeight(list.length))}`;
}

// Cheapest first; only products with an enabled cost model appear
export function tcoChart(rows) {
  const costed = rows.filter(r => r.cost.enabled && r.cost.total != null).sort((a, b) => a.cost.total - b.cost.total);
  if (!costed.length) return `<div class="explain"><b>No quantitative TCO assumptions entered.</b> Use Cost, TCO and value to add license, cloud, implementation, integration, staffing, support and exit assumptions. The qualitative economics score remains available.</div>`;
  const npv = state.settings.tcoMode === 'npv', val = r => npv ? r.cost.npv : r.cost.total;
  const build = t => base(t, {
    grid: { left: 8, right: 70, top: 8, bottom: 24, containLabel: true },
    xAxis: valueAxis(t, { axisLabel: { color: t.muted, fontSize: 11, formatter: v => money(v) } }),
    yAxis: categoryAxis(t, names(costed), { inverse: true, axisLabel: { color: t.text, fontSize: 11, width: 150, overflow: 'truncate' } }),
    tooltip: { trigger: 'item', formatter: p => { const r = costed[p.dataIndex]; return `<b>${esc(r.name)}</b><br>One-time ${money(r.cost.oneTime)}<br>Annual run ${money(r.cost.runAnnual)}<br>Exit ${money(r.cost.exit)}<br>${r.cost.years}-year ${npv ? 'NPV' : 'cash TCO'} ${money(val(r))}`; } },
    series: [{ type: 'bar', data: costed.map(val), itemStyle: { color: t.amber }, barCategoryGap: '35%', label: { show: true, position: 'right', formatter: p => money(p.value), color: t.text, fontSize: 11 } }]
  });
  return chartSlot('tco', build, barHeight(costed.length));
}
