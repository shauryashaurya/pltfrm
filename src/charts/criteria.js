// Criterion-level charts: focus-vs-benchmark trade-offs, most discriminating criteria and the scope-bound criterion comparison
import { esc, n } from '../core/format.js';
import { dims, scoreMeta } from '../core/scoring.js';
import { tradeoffs, discriminating } from '../core/analysis.js';
import { chartSlot, base, valueAxis, categoryAxis } from './echarts.js';
import { shortLabel } from './scatter.js';

// Heatmap cells keep fixed pastels with dark ink in both themes, like the score status tags
const HEAT_INK = '#2B2622', HEAT_LOW = '#E6A8A0', HEAT_MID = '#ECE8E1', HEAT_ABS_MID = '#EADBB0', HEAT_HIGH = '#9FC7A9';
const signed = v => (v >= 0 ? '+' : '') + n(v);
const ends = names => shortLabel(names[0]) + (names.length > 1 ? ` +${names.length - 1} more` : '');

// Diverging bars of focus minus benchmark; each bar is labelled at its tip with the product that scores higher
function tradeoffBars(key, list, focus, bench) {
  const lim = Math.max(1, ...list.map(x => Math.abs(x.d))) * 2.3;
  const label = x => x.d === 0 ? 'Tie' : `${shortLabel(x.winner)} ${signed(Math.abs(x.d))}`;
  const build = t => base(t, {
    grid: { left: 8, right: 8, top: 4, bottom: 4, containLabel: true },
    xAxis: valueAxis(t, { min: -lim, max: lim, axisLabel: { show: false }, splitLine: { show: false } }),
    yAxis: categoryAxis(t, list.map(x => x.c.name), { inverse: true, axisLine: { show: false }, axisLabel: { color: t.text, fontSize: 12, width: 240, overflow: 'truncate' } }),
    tooltip: { trigger: 'item', formatter: p => { const x = list[p.dataIndex]; return `<b>${esc(x.c.name)}</b><br>${esc(dims[x.dk])}<br>${esc(focus.name)} ${n(x.fv)}<br>${esc(bench.name)} ${n(x.bv)}<br>${x.winner ? esc(x.winner) + ' higher by ' + n(Math.abs(x.d)) : 'Tie'}<br>Weight ${n(x.c.weight)}%<br>${esc(scoreMeta(focus.name, x.dk, x.c.id).status)} / ${esc(scoreMeta(bench.name, x.dk, x.c.id).status)}`; } },
    series: [{ type: 'bar', barCategoryGap: '35%',
      data: list.map(x => ({ value: x.d, itemStyle: { color: x.d > 0 ? t.green : x.d < 0 ? t.red : t.gray },
        label: { show: true, position: x.d < 0 ? 'left' : 'right', fontSize: 11, fontWeight: 800, color: x.d > 0 ? t.goodText : x.d < 0 ? t.badText : t.muted, formatter: () => label(x) } })),
      markLine: { silent: true, symbol: 'none', label: { show: false }, lineStyle: { color: t.lineStrong, type: 'solid', width: 1 }, data: [{ xAxis: 0 }] } }]
  });
  return chartSlot(key, build, 16 + list.length * 28);
}

// Which side is which, above every trade-off chart
const sides = (focus, bench) => `<div class="trade-sides"><span class="bad">&larr; ${esc(bench.name)} higher</span><span class="good">${esc(focus.name)} higher &rarr;</span></div>`;

export function tradeoffChart(rows) {
  const T = tradeoffs(rows);
  if (!T) return '<p>No products available.</p>';
  const { focus, bench, all, groups } = T;
  const counts = list => ({ wins: list.filter(x => x.d > 0).length, gaps: list.filter(x => x.d < 0).length, ties: list.filter(x => x.d === 0).length });
  const total = counts(groups.flatMap(g => g.list));
  const summary = `<div class="diff-summary"><div><b>${total.wins}</b>${esc(shortLabel(focus.name))} higher</div><div><b>${total.gaps}</b>${esc(shortLabel(bench.name))} higher</div><div><b>${total.ties}</b>ties</div><div><b>${signed(all ? focus.c - bench.c : groups[0].delta)}</b>${all ? 'composite' : 'dimension'} difference</div></div>`;
  if (!all) {
    const g = groups[0], list = g.list.slice(0, 14);
    return `${summary}${list.length ? sides(focus, bench) + tradeoffBars('trade-' + g.dk, list, focus, bench) : ''}<p class="legend-note">Largest differences first${g.list.length > 14 ? `; the 14 largest of ${g.list.length}` : ''}. Labels name the higher-scoring product and its lead (0-5 scale).</p>`;
  }
  // One group per dimension; tied criteria are named on one line so nothing is hidden
  const body = groups.map(({ dk, list, delta }) => {
    const c = counts(list), differing = list.filter(x => x.d !== 0), tied = list.filter(x => x.d === 0);
    return `<details class="trade-group" open><summary><span class="tg-name">${esc(dims[dk])}</span><span class="tg-meta">${c.wins} / ${c.gaps} / ${c.ties} ties</span><span class="tg-delta" style="color:${delta > 0 ? 'var(--good-text)' : delta < 0 ? 'var(--bad-text)' : 'var(--muted)'}">${signed(delta)}</span></summary>${differing.length ? tradeoffBars('trade-' + dk, differing, focus, bench) : '<p class="legend-note">No criterion differs.</p>'}${tied.length ? `<p class="legend-note">Tied: ${tied.map(x => esc(x.c.name)).join('; ')}</p>` : ''}</details>`;
  }).join('');
  return `${summary}${sides(focus, bench)}${body}<p class="legend-note">Group number: dimension score difference (0-100). Bar labels: higher-scoring product and its lead (0-5).</p>`;
}

// Criteria with the widest spread: the bar runs from the lowest to the highest score, split at the mean;
// its left end names the lowest-scoring product and its right end the highest (+N when others tie)
export function differentiators(rows) {
  const list = discriminating(rows);
  if (!list.length) return '<p class="chart-note">Needs at least two products.</p>';
  const tip = i => { const x = list[i]; return `<b>${esc(x.c.name)}</b><br>${dims[x.dim]}<br>Lowest ${n(x.min)}: ${x.lo.map(esc).join(', ')}<br>Highest ${n(x.max)}: ${x.hi.map(esc).join(', ')}<br>Mean ${n(x.mean)} | dispersion ${n(x.sd)}`; };
  const endLabel = (x, side, seg) => {
    const room = side === 'lo' ? x.min >= 1.7 : x.max <= 3.3, inside = seg >= 1.1;
    return { show: inside || room, position: inside ? (side === 'lo' ? 'insideLeft' : 'insideRight') : (side === 'lo' ? 'left' : 'right'), formatter: () => side === 'lo' ? `${ends(x.lo)} · ${n(x.min)}` : `${n(x.max)} · ${ends(x.hi)}` };
  };
  const build = t => base(t, {
    grid: { left: 8, right: 16, top: 8, bottom: 24, containLabel: true },
    xAxis: valueAxis(t, { min: 0, max: 5, interval: 1 }),
    yAxis: categoryAxis(t, list.map(x => x.c.name), { inverse: true, axisLabel: { color: t.text, fontSize: 11, width: 240, overflow: 'truncate', formatter: (v, i) => `${v}\n{d|${dims[list[i].dim]}}`, rich: { d: { color: t.muted, fontSize: 10, padding: [2, 0, 0, 0] } } } }),
    tooltip: { trigger: 'item', formatter: p => tip(p.dataIndex) },
    series: [
      { type: 'bar', stack: 'range', data: list.map(x => x.min), itemStyle: { color: 'transparent' }, silent: true, tooltip: { show: false }, barCategoryGap: '40%' },
      { type: 'bar', stack: 'range', itemStyle: { color: t.red }, label: { fontSize: 11, fontWeight: 800, color: t.text },
        data: list.map(x => { const seg = +(x.mean - x.min).toFixed(2); return { value: seg, label: endLabel(x, 'lo', seg) }; }) },
      { type: 'bar', stack: 'range', itemStyle: { color: t.green }, label: { fontSize: 11, fontWeight: 800, color: t.text },
        data: list.map(x => { const seg = +(x.max - x.mean).toFixed(2); return { value: seg, label: endLabel(x, 'hi', seg) }; }) },
      { type: 'scatter', data: list.map((x, i) => [+x.mean.toFixed(2), i]), symbol: 'rect', symbolSize: [3, 22], itemStyle: { color: t.text }, z: 5 }
    ]
  });
  return `<div class="chart-legend"><span><i style="background:var(--c-red)"></i>Lowest to mean</span><span><i style="background:var(--c-green)"></i>Mean to highest</span><span><i style="background:var(--text);width:3px"></i>Mean</span></div>${chartSlot('differentiators', build, 50 + list.length * 40)}<p class="legend-note">Ordered by dispersion across included products (0-5). Ends name the lowest and highest scorers; +N more counts ties. Hover for every product at each end.</p>`;
}

// Criteria of one dimension (rows) against products chosen from a single offering scope (columns);
// absolute 0-5 or difference from the shown products' mean; the best score in each row is starred
export function criterionHeatmap(C, mode) {
  const { chosen, cells, dim } = C, absolute = mode !== 'delta';
  if (!chosen.length) return '<p class="chart-note">No products in this scope.</p>';
  const data = [];
  cells.forEach((x, yi) => chosen.forEach((r, xi) => {
    const raw = x.vals[xi], shown = raw == null ? null : absolute ? raw : raw - x.mean;
    data.push({ value: [xi, yi, shown == null ? '-' : +shown.toFixed(2)], best: raw != null && raw === x.best && chosen.length > 1 });
  }));
  const build = t => base(t, {
    grid: { left: 8, right: chosen.length < 6 ? `${(6 - chosen.length) * 11}%` : 8, top: 8, bottom: 8, containLabel: true },
    xAxis: categoryAxis(t, chosen.map(r => shortLabel(r.name)), { position: 'top', axisLabel: { color: t.text, fontSize: 11, interval: 0, rotate: chosen.length > 5 ? 25 : 0 }, splitArea: { show: false } }),
    yAxis: categoryAxis(t, cells.map(x => x.c.name), { inverse: true, axisLabel: { color: t.text, fontSize: 11, width: 230, overflow: 'truncate' } }),
    visualMap: { show: false, dimension: 2, min: absolute ? 0 : -1.5, max: absolute ? 5 : 1.5, inRange: { color: absolute ? [HEAT_LOW, HEAT_ABS_MID, HEAT_HIGH] : [HEAT_LOW, HEAT_MID, HEAT_HIGH] } },
    tooltip: { trigger: 'item', formatter: p => { const [xi, yi] = p.value, r = chosen[xi], x = cells[yi], raw = x.vals[xi]; return `<b>${esc(r.name)}</b><br>${esc(x.c.name)} (${n(x.c.weight)}% of ${esc(dims[dim])})<br>Score ${raw == null ? 'unknown' : n(raw)}<br>Mean of shown products ${x.mean == null ? '-' : n(x.mean)}<br>${esc(scoreMeta(r.name, dim, x.c.id).status)}`; } },
    series: [{ type: 'heatmap', data: data.map(d => ({ value: d.value, label: { fontWeight: d.best ? 900 : 500 } })), itemStyle: { borderColor: t.surface, borderWidth: 2 },
      label: { show: true, color: HEAT_INK, fontSize: 11, formatter: p => p.value[2] === '-' ? '-' : (absolute ? n(p.value[2]) : signed(p.value[2])) + (data[p.dataIndex].best ? ' ★' : '') },
      emphasis: { itemStyle: { borderColor: t.text, borderWidth: 2 } } }]
  });
  return chartSlot('heatmap', build, 90 + cells.length * 30);
}
