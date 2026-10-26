// Positioning scatters: technical vs business, and capability vs delivery economics
import { state } from '../core/state.js';
import { esc } from '../core/format.js';
import { tipText } from '../core/tooltip.js';
import { chartSlot, base, valueAxis } from './echarts.js';

export const shortLabel = name => name.replace(/ portfolio| Foundry| \+.*| Data Cloud.*/g, '').slice(0, 18);

// Products on a 0-100 grid; red when a must-have is not met. Overlapping labels shift or hide; hover always names the product.
function productScatter(key, list, { x, y, size, labelled, xName, yName, height }) {
  const build = t => base(t, {
    grid: { left: 64, right: 28, top: 20, bottom: 58 },
    xAxis: valueAxis(t, { min: 0, max: 100, interval: 25, name: xName, nameLocation: 'middle', nameGap: 34 }),
    yAxis: valueAxis(t, { min: 0, max: 100, interval: 25, name: yName, nameLocation: 'middle', nameGap: 42 }),
    tooltip: { trigger: 'item', formatter: p => tipText(list[p.dataIndex]) },
    series: [{
      type: 'scatter',
      data: list.map((r, i) => ({ value: [+x(r).toFixed(1), +y(r).toFixed(1)], symbolSize: size(r), itemStyle: { color: r.gates.fail ? t.red : t.series[i % t.series.length], opacity: .9, borderColor: t.surface, borderWidth: 1.5 } })),
      label: { show: labelled, position: 'right', distance: 6, formatter: p => shortLabel(list[p.dataIndex].name), color: t.text, fontSize: 11, textBorderColor: t.surface, textBorderWidth: 3 },
      labelLayout: { hideOverlap: true, moveOverlap: 'shiftY' },
      emphasis: { scale: 1.3, label: { show: true, fontWeight: 800 } }
    }]
  });
  return chartSlot(key, build, height);
}

export function scatterSVG(rows) {
  const filtered = state.settings.chartCategory === 'All' ? rows : rows.filter(r => r.category === state.settings.chartCategory), chosen = filtered.slice(0, 24);
  const chart = productScatter('scatter-tb', chosen, { x: r => r.b, y: r => r.t, size: r => 9 + r.a / 9, labelled: state.settings.showScatterLabels, xName: 'Business/platform coverage →', yName: 'Technical & enterprise →', height: 440 });
  const colors = chosen.map((r, i) => r.gates.fail ? 'var(--c-red)' : `var(--s${(i % 7) + 1})`);
  const legend = chosen.map((r, i) => `<span><i style="background:${colors[i]}"></i>${esc(r.name)}</span>`).join('');
  return `${chart}<div class="scatter-legend">${legend}</div><div class="chart-note">Marker size = AI/agentic score. Red = a must-have is not met. Crowded labels are hidden; hover any marker to identify it. Up to 24 products shown for the selected role.</div>`;
}

export function economicsScatter(rows) {
  const chosen = rows.slice(0, 24);
  const chart = productScatter('scatter-econ', chosen, { x: r => r.o, y: r => (r.t + r.b + r.a) / 3, size: r => 9 + r.scale / 9, labelled: true, xName: 'Delivery & operating economic favorability →', yName: 'Average technical/business/AI capability →', height: 430 });
  return `${chart}<div class="chart-note">Right means a more favorable configured build/run economics score; it does not mean lower quoted price. Marker size represents scale. Hover for dimension, must-have and evidence detail.</div>`;
}
