// Criterion-level analysis shared by the report charts and the exports: focus-vs-benchmark trade-offs,
// most discriminating criteria, scope-bound criterion comparison and the sortable risk table
import { state } from './state.js';
import { dims, econKey, resultByName, riskScore, displayValue } from './scoring.js';

const score = (name, dim, id) => { const v = state.scores[name]?.[dim]?.[id]; return v == null || v === '' ? null : +v; };

// Focus minus benchmark per criterion, largest difference first; winner is the higher-scoring product (null on a tie)
export function tradeoffs(rows) {
  const focus = resultByName(rows, state.settings.focusProduct), bench = resultByName(rows, state.settings.benchmarkProduct);
  if (!focus || !bench) return null;
  const sel = state.settings.tradeoffDimension || 'all', keys = sel === 'all' ? Object.keys(dims) : [sel];
  const groups = keys.map(dk => ({
    dk,
    delta: focus[econKey(dk)] - bench[econKey(dk)],
    list: (state.criteria[dk] || []).map(c => {
      const fv = score(focus.name, dk, c.id), bv = score(bench.name, dk, c.id), d = fv == null || bv == null ? null : fv - bv;
      return { dk, c, fv, bv, d, winner: d > 0 ? focus.name : d < 0 ? bench.name : null };
    }).filter(x => x.d != null).sort((a, b) => Math.abs(b.d) - Math.abs(a.d))
  }));
  return { focus, bench, all: sel === 'all', groups };
}

// Criteria with the widest score dispersion across the given rows; lo/hi carry every product at each end
export function discriminating(rows, limit = 14) {
  const out = [];
  for (const dim of Object.keys(dims)) for (const c of state.criteria[dim]) {
    const vals = rows.map(r => ({ name: r.name, v: score(r.name, dim, c.id) })).filter(x => x.v != null);
    if (vals.length < 2) continue;
    const mean = vals.reduce((a, x) => a + x.v, 0) / vals.length, sd = Math.sqrt(vals.reduce((a, x) => a + (x.v - mean) ** 2, 0) / vals.length);
    const min = Math.min(...vals.map(x => x.v)), max = Math.max(...vals.map(x => x.v));
    out.push({ dim, c, mean, sd, min, max, lo: vals.filter(x => x.v === min).map(x => x.name), hi: vals.filter(x => x.v === max).map(x => x.name) });
  }
  return out.sort((a, b) => b.sd - a.sd).slice(0, limit);
}

// Criterion comparison: products are chosen from one offering scope only, so engines are never set against suites.
// Scope defaults to the report filter, else the focus or benchmark product's scope when it has two or more products,
// else the largest scope; products default to the top 6 in that scope.
export function criterionComparison(rows) {
  const s = state.settings, scopes = [...new Set(rows.map(r => r.scope))];
  const size = x => rows.filter(r => r.scope === x).length;
  const near = [s.focusProduct, s.benchmarkProduct].map(nm => rows.find(r => r.name === nm)?.scope).find(x => x && size(x) >= 2);
  const fallback = s.scopeFilter && s.scopeFilter !== 'All' ? s.scopeFilter : near || [...scopes].sort((a, b) => size(b) - size(a))[0];
  const scope = scopes.includes(s.heatmapScope) ? s.heatmapScope : fallback;
  const pool = rows.filter(r => r.scope === scope).sort((a, b) => displayValue(b) - displayValue(a));
  const picked = (s.heatmapProducts || []).filter(nm => pool.some(r => r.name === nm));
  const chosen = picked.length ? pool.filter(r => picked.includes(r.name)) : pool.slice(0, 6);
  const dim = state.criteria[s.heatmapDimension] ? s.heatmapDimension : Object.keys(dims)[0];
  const cells = (state.criteria[dim] || []).map(c => {
    const vals = chosen.map(r => score(r.name, dim, c.id)), known = vals.filter(v => v != null);
    return { c, vals, mean: known.length ? known.reduce((a, b) => a + b, 0) / known.length : null, best: known.length ? Math.max(...known) : null };
  });
  return { scope, scopes, pool, chosen, dim, cells };
}

// Risk columns: key, header, value getter
export const RISK_COLUMNS = [
  ['name', 'Product', r => r.name],
  ['composite', 'Composite', r => displayValue(r)],
  ['deliveryUncertainty', 'Delivery', r => riskScore(r, 'deliveryUncertainty')],
  ['concentrationRisk', 'Lock-in', r => riskScore(r, 'concentrationRisk')],
  ['buyerReadinessDependency', 'Readiness dep.', r => riskScore(r, 'buyerReadinessDependency')],
  ['combined', 'Combined', r => riskScore(r, 'combined')],
  ['p50Months', 'P50 / P90 months', r => +r.risk.p50Months || 0]
];

// Rows after the name filter (comma-separated terms) and hidden list, sorted by the chosen column; ties keep composite order.
// Exports pass { all: true } to keep every product in the current sort order.
export function riskRows(rows, { all = false } = {}) {
  const s = state.settings, terms = all ? [] : String(s.riskFilter || '').toLowerCase().split(',').map(t => t.trim()).filter(Boolean), hidden = new Set(all ? [] : s.riskHidden || []);
  const col = RISK_COLUMNS.find(c => c[0] === s.riskSortKey) || RISK_COLUMNS[1], dir = s.riskSortDir === 'asc' ? 1 : -1, get = col[2];
  const list = rows.filter(r => !hidden.has(r.name) && (!terms.length || terms.some(t => r.name.toLowerCase().includes(t))));
  const cmp = (a, b) => col[0] === 'name' ? get(a).localeCompare(get(b)) : get(a) - get(b);
  return { list: list.map((r, i) => ({ r, i })).sort((a, b) => cmp(a.r, b.r) * dir || a.i - b.i).map(x => x.r), col, dir, hidden: [...hidden].filter(n => rows.some(r => r.name === n)) };
}
