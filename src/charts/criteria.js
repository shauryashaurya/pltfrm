// Criterion-level views: heatmap, focus-vs-benchmark trade-offs and most discriminating criteria
import { state } from '../core/state.js';
import { esc, n } from '../core/format.js';
import { dims, econKey, resultByName, scoreMeta } from '../core/scoring.js';
import { chartSlot, base, valueAxis, categoryAxis } from './echarts.js';
import { shortLabel } from './scatter.js';

// Heatmap cells keep fixed pastels with dark ink in both themes, like the score status tags
const HEAT_INK = '#2B2622', HEAT_LOW = '#E6A8A0', HEAT_MID = '#ECE8E1', HEAT_ABS_MID = '#EADBB0', HEAT_HIGH = '#9FC7A9';
const signed = v => (v >= 0 ? '+' : '') + n(v);

// Rows = criteria of one dimension, columns = top 10 products; cells show absolute score or delta vs mean/benchmark
export function criterionHeatmap(rows, dim) {
  const cs = state.criteria[dim], chosen = rows.slice(0, 10), mode = state.settings.heatmapMode, bench = resultByName(rows, state.settings.benchmarkProduct);
  const cells = [];
  cs.forEach((c, yi) => {
    const vals = chosen.map(r => state.scores[r.name]?.[dim]?.[c.id]).filter(v => v != null).map(Number), mean = vals.length ? vals.reduce((a, b) => a + b, 0) / vals.length : 0, bv = state.scores[bench?.name]?.[dim]?.[c.id];
    chosen.forEach((r, xi) => {
      const raw = state.scores[r.name]?.[dim]?.[c.id];
      const delta = raw == null ? null : (mode === 'benchmark' ? (bv == null ? null : raw - bv) : raw - mean);
      const shown = mode === 'absolute' ? raw : delta;
      cells.push({ value: [xi, yi, shown == null ? '-' : +(+shown).toFixed(2)], raw, delta, r, c });
    });
  });
  const absolute = mode === 'absolute';
  const build = t => base(t, {
    grid: { left: 8, right: 8, top: 8, bottom: 8, containLabel: true },
    xAxis: categoryAxis(t, chosen.map(r => shortLabel(r.name)), { position: 'top', axisLabel: { color: t.text, fontSize: 11, interval: 0, rotate: 30 }, splitArea: { show: false } }),
    yAxis: categoryAxis(t, cs.map(c => c.name), { inverse: true, axisLabel: { color: t.text, fontSize: 11, width: 230, overflow: 'truncate' } }),
    visualMap: { show: false, dimension: 2, min: absolute ? 0 : -1.5, max: absolute ? 5 : 1.5, inRange: { color: absolute ? [HEAT_LOW, HEAT_ABS_MID, HEAT_HIGH] : [HEAT_LOW, HEAT_MID, HEAT_HIGH] } },
    tooltip: { trigger: 'item', formatter: p => { const x = cells[p.dataIndex]; return `<b>${esc(x.r.name)}</b><br>${esc(x.c.name)} (${n(x.c.weight)}% weight)<br>Raw score ${x.raw == null ? 'unknown' : n(x.raw)}<br>${mode === 'benchmark' ? 'Delta vs ' + esc(bench?.name) : mode === 'delta' ? 'Delta vs displayed-product mean' : 'Absolute score'} ${x.delta == null ? '-' : signed(x.delta)}`; } },
    series: [{ type: 'heatmap', data: cells.map(x => x.value), itemStyle: { borderColor: t.surface, borderWidth: 2 },
      label: { show: true, color: HEAT_INK, fontSize: 11, fontWeight: 800, formatter: p => p.value[2] === '-' ? '-' : absolute ? n(p.value[2]) : signed(p.value[2]) },
      emphasis: { itemStyle: { borderColor: t.text, borderWidth: 2 } } }]
  });
  return chartSlot('heatmap', build, 90 + cs.length * 32);
}

// Diverging bars of focus minus benchmark, one chart per list of criteria
function tradeoffBars(key, list, focus, bench) {
  const lim = Math.max(1, ...list.map(x => Math.abs(x.d)));
  const build = t => base(t, {
    grid: { left: 8, right: 48, top: 4, bottom: 4, containLabel: true },
    xAxis: valueAxis(t, { min: -lim, max: lim, axisLabel: { show: false }, splitLine: { show: false } }),
    yAxis: categoryAxis(t, list.map(x => x.c.name), { inverse: true, axisLine: { show: false }, axisLabel: { color: t.text, fontSize: 12, width: 260, overflow: 'truncate' } }),
    tooltip: { trigger: 'item', formatter: p => { const x = list[p.dataIndex]; return `<b>${esc(x.c.name)}</b><br>${esc(dims[x.dk])}<br>${esc(focus.name)} ${n(x.fv)}<br>${esc(bench.name)} ${n(x.bv)}<br>Delta ${signed(x.d)}<br>Weight ${n(x.c.weight)}%<br>${esc(scoreMeta(focus.name, x.dk, x.c.id).status)} / ${esc(scoreMeta(bench.name, x.dk, x.c.id).status)}`; } },
    series: [{ type: 'bar', barCategoryGap: '35%',
      data: list.map(x => ({ value: x.d, itemStyle: { color: x.d > 0 ? t.green : x.d < 0 ? t.red : t.gray }, label: { color: x.d > 0 ? t.goodText : x.d < 0 ? t.badText : t.muted } })),
      label: { show: true, position: 'right', fontSize: 11, fontWeight: 800, formatter: p => signed(p.value) },
      markLine: { silent: true, symbol: 'none', label: { show: false }, lineStyle: { color: t.lineStrong, type: 'solid', width: 1 }, data: [{ xAxis: 0 }] } }]
  });
  return chartSlot(key, build, 16 + list.length * 28);
}

// Focus vs benchmark per criterion, largest differences first.
// "all" shows one collapsible group per dimension so every dimension stays visible.
export function tradeoffChart(rows) {
  const focus = resultByName(rows, state.settings.focusProduct), bench = resultByName(rows, state.settings.benchmarkProduct), dim = state.settings.tradeoffDimension;
  if (!focus || !bench) return '<p>No products available.</p>';
  const all = dim === 'all', dimKeys = all ? Object.keys(dims) : [dim];
  const diffsFor = dk => (state.criteria[dk] || []).map(c => {
    const fv = state.scores[focus.name]?.[dk]?.[c.id], bv = state.scores[bench.name]?.[dk]?.[c.id], d = fv == null || bv == null ? null : +fv - +bv;
    return { dk, c, fv, bv, d };
  }).filter(x => x.d != null).sort((a, b) => Math.abs(b.d) - Math.abs(a.d));
  const counts = list => ({ wins: list.filter(x => x.d > 0).length, gaps: list.filter(x => x.d < 0).length, ties: list.filter(x => x.d === 0).length });
  const dimDelta = dk => focus[econKey(dk)] - bench[econKey(dk)];
  const groups = dimKeys.map(dk => ({ dk, list: diffsFor(dk) }));
  const total = counts(groups.flatMap(g => g.list));
  const summary = `<div class="diff-summary"><div><b>${total.wins}</b>higher criteria</div><div><b>${total.gaps}</b>lower criteria</div><div><b>${total.ties}</b>ties</div><div><b>${n(all ? focus.c - bench.c : dimDelta(dim))}</b>${all ? '6D delta' : 'dimension delta'}</div></div>`;
  const legend = `Right/green: ${esc(focus.name)} scores higher. Left/red: ${esc(bench.name)} scores higher.`;
  if (!all) {
    const list = groups[0].list.slice(0, 14);
    return `${summary}${list.length ? tradeoffBars('trade-' + dim, list, focus, bench) : ''}<p class="legend-note">${legend} Ordered by absolute difference${groups[0].list.length > 14 ? `; showing the 14 largest of ${groups[0].list.length}` : ''}; hover for raw scores and weight.</p>`;
  }
  // Each group charts its differing criteria; tied criteria are named on one line so nothing is hidden
  const body = groups.map(({ dk, list }) => {
    const c = counts(list), d = dimDelta(dk), differing = list.filter(x => x.d !== 0), tied = list.filter(x => x.d === 0);
    return `<details class="trade-group" open><summary><span class="tg-name">${esc(dims[dk])}</span><span class="tg-meta">${c.wins} higher | ${c.gaps} lower | ${c.ties} ties</span><span class="tg-delta" style="color:${d > 0 ? 'var(--good-text)' : d < 0 ? 'var(--bad-text)' : 'var(--muted)'}">${signed(d)}</span></summary>${differing.length ? tradeoffBars('trade-' + dk, differing, focus, bench) : '<p class="legend-note">No criterion differs in this dimension.</p>'}${tied.length ? `<p class="legend-note">Tied: ${tied.map(x => esc(x.c.name)).join('; ')}</p>` : ''}</details>`;
  }).join('');
  return `${summary}${body}<p class="legend-note">One group per dimension; the number on each group is its dimension score delta (0-100). ${legend} Hover any bar for raw scores and weight.</p>`;
}

// Criteria with the largest score spread across included products: min-max range bar with a mean marker
export function differentiators(rows) {
  const all = [];
  for (const dim of Object.keys(dims)) for (const c of state.criteria[dim]) {
    const vals = rows.map(r => ({ name: r.name, v: state.scores[r.name]?.[dim]?.[c.id] })).filter(x => x.v != null).map(x => ({ name: x.name, v: +x.v }));
    if (vals.length < 2) continue;
    const mean = vals.reduce((a, x) => a + x.v, 0) / vals.length, sd = Math.sqrt(vals.reduce((a, x) => a + (x.v - mean) ** 2, 0) / vals.length);
    all.push({ dim, c, mean, sd, lo: vals.reduce((a, x) => x.v < a.v ? x : a), hi: vals.reduce((a, x) => x.v > a.v ? x : a) });
  }
  all.sort((a, b) => b.sd - a.sd);
  const list = all.slice(0, 14);
  const tip = i => { const x = list[i]; return `<b>${esc(x.c.name)}</b><br>${dims[x.dim]}<br>Low ${esc(x.lo.name)} ${n(x.lo.v)}<br>High ${esc(x.hi.name)} ${n(x.hi.v)}<br>Mean ${n(x.mean)} | dispersion ${n(x.sd)}`; };
  const build = t => base(t, {
    grid: { left: 8, right: 16, top: 8, bottom: 24, containLabel: true },
    xAxis: valueAxis(t, { min: 0, max: 5, interval: 1 }),
    yAxis: categoryAxis(t, list.map(x => x.c.name), { inverse: true, axisLabel: { color: t.text, fontSize: 11, width: 260, overflow: 'truncate', formatter: (v, i) => `${v}\n{d|${dims[list[i].dim]}}`, rich: { d: { color: t.muted, fontSize: 10, padding: [2, 0, 0, 0] } } } }),
    tooltip: { trigger: 'item', formatter: p => tip(p.dataIndex) },
    series: [
      // Transparent base up to the minimum, then the visible min-to-max span
      { type: 'bar', stack: 'range', data: list.map(x => x.lo.v), itemStyle: { color: 'transparent' }, silent: true, tooltip: { show: false }, barCategoryGap: '45%' },
      { type: 'bar', stack: 'range', data: list.map(x => +(x.hi.v - x.lo.v).toFixed(2)), itemStyle: { color: t.blue } },
      { type: 'scatter', data: list.map((x, i) => [+x.mean.toFixed(2), i]), symbol: 'rect', symbolSize: [3, 20], itemStyle: { color: t.text }, z: 5 }
    ]
  });
  return `${chartSlot('differentiators', build, 50 + list.length * 38)}<p class="legend-note">Criteria ordered by score dispersion across included products. Each bar spans the lowest to highest score (0-5); the dark marker is the mean. Hover for which products sit at each end.</p>`;
}
