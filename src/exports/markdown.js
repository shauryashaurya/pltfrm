// Full Markdown report: every result, assumption, rubric and must-have in one portable file
import { state } from '../core/state.js';
import { dl, n, money } from '../core/format.js';
import { dims, DIMENSIONS, allResults, product, benefits, buyerReadinessScore, scoreCoverage, scoreMeta, displayValue, riskScore } from '../core/scoring.js';
import { tradeoffs, discriminating, criterionComparison, riskRows } from '../core/analysis.js';
import { SCOPE_REGISTRY } from '../config.js';
import { expose } from '../core/actions.js';
import { EXPORT_FOOTER, mustHaveLabel } from '../config.js';

function mdEsc(v) { return String(v ?? '').replace(/\|/g, '\\|').replace(/\r?\n/g, ' '); }
function mdTable(headers, rows) { return '| ' + headers.map(mdEsc).join(' | ') + ' |\n| ' + headers.map(() => '---').join(' | ') + ' |\n' + rows.map(r => '| ' + r.map(mdEsc).join(' | ') + ' |').join('\n'); }

export function buildMarkdown() {
  const rows = allResults(), s = state.settings, date = new Date().toISOString().slice(0, 10), cov = scoreCoverage(), out = [];
  const shown = included => included.filter(p => !p.hidden);

  // Summary and headline comparison
  out.push('# ' + state.studyTitle, '', '**Generated:** ' + date, '', `**Scenario:** ${s.scenarioName}`, '', `**Industry/domain:** ${s.industry}`, '', `**Priority use cases:** ${s.priorityUseCases}`, '',
    '## Executive summary', '', `The study evaluates ${rows.length} offerings across ${Object.keys(state.dimensionWeights).length} scored dimensions plus must-haves, evidence confidence and explicit risk/readiness overlays. Offering scope shown: ${s.scopeFilter && s.scopeFilter !== 'All' ? s.scopeFilter : 'all offerings'}. The configured composite method is ${s.compositeMethod}; the shortlist threshold is ${s.shortlistThreshold}.`, '',
    '## Multi-dimensional comparison', '', mdTable(['Offering', 'Scope', 'Category', ...DIMENSIONS.map(d => d.column), 'Composite', 'Confidence', 'Adjusted', 'TCO', 'Risk D/C/R', 'Must-haves met/not met/unchecked'], rows.map(r => [r.name, r.scope, r.category, ...DIMENSIONS.map(d => n(r[d.letter])), n(r.c), r.confidence, n(r.adjusted), r.cost.enabled ? money(s.tcoMode === 'npv' ? r.cost.npv : r.cost.total) : 'Not modeled', `${n(r.risk.deliveryUncertainty || 0)}/${n(r.risk.concentrationRisk || 0)}/${n(r.risk.buyerReadinessDependency || 0)}`, `${r.gates.pass}/${r.gates.fail}/${r.gates.unknown}`])), '');

  // Criterion-level analysis: the report's trade-off explorer, discriminating criteria and scope-bound comparison
  const T = tradeoffs(rows);
  if (T) out.push('## Trade-offs: ' + T.focus.name + ' vs ' + T.bench.name, '', `Composite difference: ${n(T.focus.c - T.bench.c)}. Lead is on the 0-5 criterion scale.`, '', mdTable(['Dimension', 'Criterion', T.focus.name, T.bench.name, 'Higher', 'Lead'], T.groups.flatMap(g => g.list.map(x => [dims[x.dk], x.c.name, n(x.fv), n(x.bv), x.winner || 'Tie', n(Math.abs(x.d))]))), '');
  out.push('## Most discriminating criteria', '', mdTable(['Criterion', 'Dimension', 'Lowest', 'Highest', 'Mean', 'Dispersion'], discriminating(rows).map(x => [x.c.name, dims[x.dim], x.lo.join(', ') + ' (' + n(x.min) + ')', x.hi.join(', ') + ' (' + n(x.max) + ')', n(x.mean), n(x.sd)])), '');
  const C = criterionComparison(rows);
  if (C.chosen.length) out.push('## Criterion comparison: ' + dims[C.dim], '', 'Offering scope: ' + C.scope + '.', '', mdTable(['Criterion', ...C.chosen.map(r => r.name)], C.cells.map(x => [x.c.name, ...x.vals.map(v => v == null ? '-' : n(v) + (v === x.best && C.chosen.length > 1 ? ' *' : ''))])), '', '* best in row', '');

  // Scenario-specific dimensions: domain fit, adoption and value
  out.push('## Domain and use-case fit', '', s.domainProfileNote, '', 'Domain-fit scores must be replaced for the named industry and use case; they are not universal product ratings.', '',
    '## Adoption, value and buyer readiness', '', `Buyer readiness: ${n(buyerReadinessScore())}/100.`, '', mdTable(['Offering', 'Adoption/value score', 'Gross benefit', 'Net value', 'ROI', 'Payback'], rows.map(r => { const bv = benefits(r.name); return [r.name, n(r.v), bv.enabled ? money(bv.gross) : 'Not modeled', bv.enabled ? money(bv.net) : 'Not modeled', bv.enabled && bv.roi != null ? n(bv.roi) + '%' : '-', bv.enabled && bv.payback != null ? n(bv.payback) + ' months' : '-']; })), '');

  // Economics, roles and risk
  const R = riskRows(rows, { all: true });
  out.push('## Build-vs-buy and operating economics', '', `Economics is an economic-favorability score, not a price quote. Quantitative TCO uses buyer-entered assumptions over ${s.costYears} years.`, '', mdTable(['Offering', 'Enabled', 'License', 'Cloud', 'Support', 'Implementation', 'Integration', 'Training', 'Run FTE', 'Change FTE', 'Other annual', 'Exit', 'Cash TCO', 'NPV', 'Assumptions'], rows.map(r => { const m = product(r.name)?.costModel || {}; return [r.name, !!m.enabled, money(m.licenseAnnual || 0), money(m.cloudAnnual || 0), money(m.supportAnnual || 0), money(m.implementationOneTime || 0), money(m.integrationOneTime || 0), money(m.trainingOneTime || 0), m.ongoingFTE || 0, m.changeFTE || 0, money(m.otherAnnual || 0), money(m.exitOneTime || 0), r.cost.enabled ? money(r.cost.total) : 'Not modeled', r.cost.enabled ? money(r.cost.npv) : 'Not modeled', m.notes || '']; })), '',
    '## Product roles, fit and boundaries', '', mdTable(['Offering', 'Primary role', 'Representative fit', 'Boundary / verification need'], rows.map(r => [r.name, r.role, r.fit, r.boundary])), '',
    '## Risk overlays', '', `Sorted by ${R.col[1].toLowerCase()}, ${R.dir > 0 ? 'ascending' : 'descending'}. Risk runs 0 (low) to 5 (high).`, '',mdTable(['Offering', 'Composite', 'Delivery uncertainty', 'Concentration risk', 'Buyer-readiness dependency', 'Combined', 'P50 months', 'P90 months', 'Low TCO factor', 'High TCO factor'], R.list.map(r => [r.name, n(displayValue(r)), n(riskScore(r, 'deliveryUncertainty')), n(riskScore(r, 'concentrationRisk')), n(riskScore(r, 'buyerReadinessDependency')), n(riskScore(r, 'combined')), r.risk.p50Months || 'Not set', r.risk.p90Months || 'Not set', r.risk.lowTcoFactor || '', r.risk.highTcoFactor || ''])), '');

  // Method, provenance and full criterion detail
  out.push('## Scoring methodology', '', `Dimension weights: ${Object.keys(dims).map(d => dims[d] + ' ' + n(state.dimensionWeights[d])).join('; ')}.`, '', '- Scores use 0-5; dimension score = weighted mean × 20 (0-100).', `- Composite: weighted ${s.compositeMethod} mean of dimension scores.`,'- Evidence-adjusted composite = composite × confidence factor (A 1.00, B 0.90, C 0.75, D 0.50, E 0.25).', '- Each score rates what the offering delivers natively toward a cross-enterprise operational platform; engines, databases and frameworks are capped on platform-level criteria, and capped cells are tagged "Rescored for platform scope".', '', mdTable(['Offering scope', 'Description'], SCOPE_REGISTRY.map(x => [x.name, x.description])), '',
    '## Score completeness and provenance', '', `Visible cells: ${cov.total}; blank: ${cov.missing}; user-input-required: ${cov.user}; baseline requiring validation: ${cov.validate}. Packaged domain and adoption scores are placeholders for the baseline scenario and buyer profile; replace them before selection.`, '',
    mdTable(['Offering', 'Dimension', 'Criterion', 'Score', 'Status', 'Rationale'], shown(state.products).flatMap(p => Object.keys(dims).flatMap(d => state.criteria[d].map(c => [p.name, dims[d], c.name, state.scores[p.name]?.[d]?.[c.id] ?? 'Blank', scoreMeta(p.name, d, c.id).status, scoreMeta(p.name, d, c.id).rationale])))), '', '### Criterion weights', '');
  for (const dim of Object.keys(dims)) out.push('#### ' + dims[dim], '', mdTable(['Criterion', 'Weight', 'Definition'], state.criteria[dim].map(c => [c.name, n(c.weight), c.description])), '');

  // Readiness rubric, must-haves, validation plan, limitations
  const vr = state.validationPlan || [], vh = Object.keys(vr[0] || {}), mh = state.mustHaveDefaults || { met: 4, notMet: 1.5 };
  out.push('## Buyer-readiness rubric', '', mdTable(['Criterion', 'Weight', 'Score', 'Definition'], state.buyerReadiness.criteria.map(c => [c.name, n(c.weight), state.buyerReadiness.scores[c.id], c.description])), '',
    '## Must-haves', '', `Defaults come from the criterion scores behind each must-have: Met when the weakest is ${n(mh.met)}+, Not met at ${n(mh.notMet)} or below, Not checked in between; Not applicable when the product's scope caps every one of those criteria. Recorded statuses replace defaults.`, '',mdTable(['Area', 'Required evidence', 'Default basis'], state.gates.map(g => [g.area, g.evidence, (g.basis || []).map(b => b.id).join('; ')])), '',
    '### Must-have status matrix', '', mdTable(['Offering', ...state.gates.map(g => g.area)], shown(state.products).map(p => [p.name, ...state.gates.map((g, i) => mustHaveLabel((state.gateStatus[p.name] || {})[i] || 'Unknown'))])), '',
    '## Validation and vetting plan', '', mdTable(vh, vr.map(r => vh.map(h => r[h]))), '',
    '## Interpretation and limitations', '', 'Check must-haves before scoring. Compare within product role. Domain fit is scenario-specific. Adoption and benefits are buyer-specific. Risk/readiness overlays are not capability scores. Monetary outputs are not vendor quotes.');
  out.push('', '---', '', EXPORT_FOOTER, '');
  return out.join('\n');
}

export function exportMarkdown() { dl('platform-study-report.md', buildMarkdown(), 'text/markdown'); }

expose({ exportMarkdown });
