// Positioning scatters: technical vs business, and capability vs delivery economics
import { state } from '../core/state.js';
import { esc } from '../core/format.js';
import { tipText } from '../core/tooltip.js';
import { chartSlot, base, valueAxis, scaledAxis } from './echarts.js';

export const shortLabel = name => name.replace(/ portfolio| Foundry| \+.*| Data Cloud.*/g, '').slice(0, 18);

export const SCALE_MODES = [['fit', 'Fit to data'], ['rank', 'Rank (even spacing)'], ['absolute', 'Absolute']];

// Axis-scale picker for one chart; the choice is stored in state.settings[key]
export function scaleControl(key) {
  const v = state.settings[key] || 'fit';
  return `<label>Axis scale<select onchange="PB.setView('${key}',this.value)">${SCALE_MODES.map(([k, l]) => `<option value="${k}" ${k === v ? 'selected' : ''}>${l}</option>`).join('')}</select></label>`;
}

// One scaled value axis: the scale's range and labels merged over the theme's axis style
export function scaledValueAxis(t, sc, extra) {
  const axis = valueAxis(t, extra);
  return { ...axis, ...sc.axis, axisLabel: { ...axis.axisLabel, ...(sc.axis.axisLabel || {}) } };
}

export const scaleNote = mode => mode === 'rank' ? 'Rank axes: products are evenly spaced by order, so distances do not show score gaps; hover for the scores.'
  : mode === 'absolute' ? 'Axes show the full 0-100 scale.' : 'Axes are zoomed to the plotted products; the printed axis values show the range.';

// Products on scaled axes; red when a must-have is not met. Overlapping labels shift or hide; hover always names the product.
function productScatter(key, list, { x, y, size, labelled, xName, yName, height, mode }) {
  const sx = scaledAxis(list.map(x), mode), sy = scaledAxis(list.map(y), mode);
  const build = t => base(t, {
    grid: { left: 64, right: 28, top: 20, bottom: 58 },
    xAxis: scaledValueAxis(t, sx, { name: xName, nameLocation: 'middle', nameGap: 34 }),
    yAxis: scaledValueAxis(t, sy, { name: yName, nameLocation: 'middle', nameGap: 42 }),
    tooltip: { trigger: 'item', formatter: p => tipText(list[p.dataIndex]) },
    series: [{
      type: 'scatter',
      data: list.map((r, i) => ({ value: [+sx.map(x(r)).toFixed(2), +sy.map(y(r)).toFixed(2)], symbolSize: size(r), itemStyle: { color: r.gates.fail ? t.red : t.series[i % t.series.length], opacity: .9, borderColor: t.surface, borderWidth: 1.5 } })),
      label: { show: labelled, position: 'right', distance: 6, formatter: p => shortLabel(list[p.dataIndex].name), color: t.text, fontSize: 11, textBorderColor: t.surface, textBorderWidth: 3 },
      labelLayout: { hideOverlap: true, moveOverlap: 'shiftY' },
      emphasis: { scale: 1.3, label: { show: true, fontWeight: 800 } }
    }]
  });
  return chartSlot(key, build, height);
}

export function scatterSVG(rows) {
  const filtered = state.settings.chartCategory === 'All' ? rows : rows.filter(r => r.category === state.settings.chartCategory), chosen = filtered.slice(0, 24), mode = state.settings.scaleTB || 'fit';
  const chart = productScatter('scatter-tb', chosen, { x: r => r.b, y: r => r.t, size: r => 9 + r.a / 9, labelled: state.settings.showScatterLabels, xName: 'Business/platform coverage →', yName: 'Technical & enterprise →', height: 440, mode });
  const colors = chosen.map((r, i) => r.gates.fail ? 'var(--c-red)' : `var(--s${(i % 7) + 1})`);
  const legend = chosen.map((r, i) => `<span><i style="background:${colors[i]}"></i>${esc(r.name)}</span>`).join('');
  return `${chart}<div class="scatter-legend">${legend}</div><ul class="chart-notes"><li>Marker size: AI/agentic score. Red: a must-have is not met.</li><li>${scaleNote(mode)}</li><li>Up to 24 products for the selected role.</li></ul>`;
}

export function economicsScatter(rows) {
  const chosen = rows.slice(0, 24), mode = state.settings.scaleEcon || 'fit';
  const chart = productScatter('scatter-econ', chosen, { x: r => r.o, y: r => (r.t + r.b + r.a) / 3, size: r => 9 + r.scale / 9, labelled: true, xName: 'Delivery & operating economics →', yName: 'Mean technical, business and AI capability →', height: 430, mode });
  return `${chart}<ul class="chart-notes"><li>Right: lower build and run burden. Quoted price is modelled separately under TCO.</li><li>Marker size: scale.</li><li>${scaleNote(mode)}</li></ul>`;
}
