// Six-axis radar of the leading products (ECharts), with zoomed or absolute axes, plus a dimension table for the same products
import { state } from '../core/state.js';
import { esc, n } from '../core/format.js';
import { displayValue } from '../core/scoring.js';
import { chartSlot, base } from './echarts.js';
import { shortLabel } from './scatter.js';

const AXES = [['t', 'Technical'], ['b', 'Business'], ['a', 'AI'], ['o', 'Economics'], ['d', 'Domain fit'], ['v', 'Adoption/value']];

// Compact hover card: name, 6D and the six dimensions in two columns, then confidence and must-haves
function radarTip(r) {
  const cell = (label, v) => `<span style="opacity:.75">${label}</span><b style="text-align:right">${n(v)}</b>`;
  return `<div style="font-weight:800;font-size:12px;margin-bottom:4px">${esc(r.name)}</div>`
    + `<div style="display:grid;grid-template-columns:auto auto auto auto;gap:1px 8px">${cell('6D', displayValue(r))}${AXES.map(([k, name]) => cell(name.replace('Adoption/value', 'Adoption').replace('Domain fit', 'Domain'), r[k])).join('')}</div>`
    + `<div style="opacity:.75;margin-top:4px">Confidence ${r.confidence} | must-haves ${r.gates.pass}/${r.gates.fail}/${r.gates.unknown}</div>`;
}

// Products shown: the top N by the displayed 6D, the same order as the executive summary
export function radarSelection(rows) {
  const count = Math.max(2, Math.min(+state.settings.radarCount || 7, 12)), mode = state.settings.radarScale === 'absolute' ? 'absolute' : 'zoom';
  return { count, mode, chosen: rows.slice().sort((a, b) => displayValue(b) - displayValue(a)).slice(0, count) };
}

export function radarChart(rows) {
  const { count, mode, chosen } = radarSelection(rows);
  // Zoom gives each axis its own range around the compared products so differences are visible
  const ranges = Object.fromEntries(AXES.map(([k]) => {
    if (mode === 'absolute') return [k, [0, 100]];
    const vals = chosen.map(r => r[k]), lo = Math.min(...vals), hi = Math.max(...vals), span = Math.max(12, hi - lo), mid = (lo + hi) / 2;
    return [k, [Math.max(0, Math.floor(mid - span * .7)), Math.min(100, Math.ceil(mid + span * .7))]];
  }));
  // Draw the largest shapes first so smaller ones sit on top and stay reachable; colours and legend keep rank order
  const scaled = r => AXES.map(([k]) => (r[k] - ranges[k][0]) / Math.max(.001, ranges[k][1] - ranges[k][0]));
  const area = r => { const s = scaled(r); return s.reduce((a, v, i) => a + v * s[(i + 1) % s.length], 0); };
  const order = chosen.map((r, i) => ({ r, i })).sort((a, b) => area(b.r) - area(a.r));
  const build = t => base(t, {
    color: t.series,
    legend: { bottom: 0, left: 'center', icon: 'roundRect', itemWidth: 14, itemHeight: 3, itemGap: 14, textStyle: { color: t.text, fontSize: 11 }, data: chosen.map(r => shortLabel(r.name)) },
    radar: {
      center: ['50%', '45%'], radius: '62%', shape: 'polygon', splitNumber: 4,
      indicator: AXES.map(([k, name]) => ({ name, min: ranges[k][0], max: ranges[k][1] })),
      axisName: { color: t.text, fontSize: 12, fontWeight: 800, formatter: (name, ind) => mode === 'zoom' ? `${name}\n{r|${ind.min}-${ind.max}}` : name, rich: { r: { color: t.muted, fontSize: 10, fontWeight: 400, padding: [3, 0, 0, 0] } } },
      axisLine: { lineStyle: { color: t.lineStrong, width: 1 } },
      splitLine: { lineStyle: { color: t.line, width: 1, type: [3, 3] } },
      splitArea: { show: true, areaStyle: { color: [t.surface, t.surface2] } }
    },
    tooltip: { trigger: 'item', formatter: p => radarTip(order[p.dataIndex].r) },
    series: [{
      type: 'radar', symbol: 'circle', symbolSize: 6,
      // No fills: only lines and points take the pointer, so an outer shape never blocks the ones inside it
      lineStyle: { width: 2, join: 'round', cap: 'round' },
      itemStyle: { borderColor: t.surface, borderWidth: 1.5 },
      // Hovering a shape thickens and lifts it and fades the rest, so one product reads at a time
      emphasis: { focus: 'self', scale: 1.5, lineStyle: { width: 3.5, shadowBlur: 8, shadowColor: 'rgba(0,0,0,.18)' } },
      blur: { lineStyle: { opacity: .14 }, itemStyle: { opacity: .14 } },
      data: order.map(({ r, i }) => { const c = t.series[i % t.series.length]; return { name: shortLabel(r.name), value: AXES.map(([k]) => +r[k].toFixed(1)), lineStyle: { color: c }, itemStyle: { color: c } }; })
    }]
  });
  const controls = `<div class="viz-controls no-print"><label>Axis scale<select onchange="PB.setView('radarScale',this.value)"><option value="zoom" ${mode === 'zoom' ? 'selected' : ''}>Zoom to compared products</option><option value="absolute" ${mode === 'absolute' ? 'selected' : ''}>Absolute 0-100</option></select></label><label>Products<input type="number" min="2" max="12" value="${count}" onchange="PB.setView('radarCount',+this.value)"></label></div>`;
  const note = mode === 'zoom'
    ? '<div class="zoom-note"><b>Zoomed axes:</b> each dimension uses its own range, printed under the axis name. This makes differences visible but changes the visual scale; use Absolute 0-100 to compare magnitudes.</div>'
    : '<div class="chart-note">All axes use 0-100.</div>';
  return `${controls}${chartSlot('radar', build, 480)}<div class="chart-note">Hover a shape to bring it forward and see its full breakdown; click a name in the legend to hide or show it.</div>${note}`;
}

// Dimension table beside the radar: the same products with all six scores and 6D, shaded by score
export function profileTable(rows) {
  const { chosen } = radarSelection(rows);
  const cols = [['c', '6D'], ['t', 'Tech'], ['b', 'Bus.'], ['a', 'AI'], ['o', 'Econ.'], ['d', 'Domain'], ['v', 'Adopt.']];
  const val = (r, k) => k === 'c' ? displayValue(r) : r[k];
  const body = chosen.map(r => `<tr><td>${esc(r.name)}</td>${cols.map(([k]) => { const v = val(r, k); return `<td class="num${k === 'c' ? ' lead' : ''}" style="--v:${Math.max(0, Math.min(100, v)).toFixed(0)}">${n(v)}</td>`; }).join('')}</tr>`).join('');
  return `<table class="profile-table"><thead><tr><th>Product</th>${cols.map(([, l]) => `<th>${l}</th>`).join('')}</tr></thead><tbody>${body}</tbody></table><div class="chart-note">Scores out of 100; darker cells score higher. 6D is ${state.settings.showEvidenceAdjusted ? 'evidence-adjusted' : 'raw'}.</div>`;
}
