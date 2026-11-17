// Methodology: scales, dimensions and weights, offering scopes, calculation, must-have defaults, provenance and verification
import { state } from '../core/state.js';
import { $, esc, n } from '../core/format.js';
import { registerView } from '../core/registry.js';
import { DIMENSIONS } from '../core/scoring.js';
import { SCOPE_REGISTRY, WEIGHT_PRESETS } from '../config.js';

const SCORE_SCALE = [[0, 'Absent or out of scope'], [1, 'Limited, early or heavy custom build'], [2, 'Basic, with material gaps'], [3, 'Production-capable for defined use cases'], [4, 'Broad, documented capability'], [5, 'Integrated and broadly evidenced']];
const CONFIDENCE_TEXT = { A: 'Independently tested or third-party verified', B: 'Broad official evidence and production references', C: 'Official or public evidence; needs customer validation', D: 'Early or incomplete enterprise evidence', E: 'Unknown or insufficient evidence' };

const list = items => `<ul>${items.map(x => `<li>${x}</li>`).join('')}</ul>`;
const ol = items => `<ol>${items.map(x => `<li>${x}</li>`).join('')}</ol>`;
const presetWeights = key => DIMENSIONS.map(d => n(WEIGHT_PRESETS[key]?.dimensions?.[d.key] ?? 0).replace(/\.0$/, '')).join('/');

function renderMethodology() {
  const dw = state.dimensionWeights, total = DIMENSIONS.reduce((a, d) => a + (+dw[d.key] || 0), 0) || 1, mh = state.mustHaveDefaults || { met: 4, notMet: 1.5 };

  const dimTable = `<table><thead><tr><th>Dimension</th><th>Weight</th><th>Share</th><th>Criteria</th></tr></thead><tbody>${DIMENSIONS.map(d => `<tr><td>${esc(d.label)}</td><td class="num">${n(+dw[d.key] || 0)}</td><td class="num">${n((+dw[d.key] || 0) / total * 100)}%</td><td class="num">${(state.criteria[d.key] || []).length}</td></tr>`).join('')}</tbody></table>`;

  $('methodology').innerHTML = `<div class="card methodology"><h2>Scoring and verification guide</h2><div class="viz-controls no-print editor-only"><button class="btn" type="button" onclick="PB.exportMethodologyCSV()">Export methodology CSV</button></div>`
    + `<h3>Score scale</h3><table><tr><th>Score</th><th>Meaning</th></tr>${SCORE_SCALE.map(x => `<tr><td>${x[0]}</td><td>${x[1]}</td></tr>`).join('')}</table>`
    + `<h3 class="gap">Confidence scale</h3><table><tr><th>Grade</th><th>Factor</th><th>Evidence standard</th></tr>${Object.entries(state.confidenceFactors).map(([k, v]) => `<tr><td>${k}</td><td>${v}</td><td>${CONFIDENCE_TEXT[k] || ''}</td></tr>`).join('')}</table>`

    + `<h3 class="gap">Dimensions and weights</h3>${dimTable}`
    + list([
      'Weights are relative and normalize to 100%.',
      `Cross-enterprise default: ${presetWeights('cross-enterprise')}. Single-domain preset: ${presetWeights('single-domain')} (order as in the table).`,
      'Domain fit and business coverage weigh most: the scenario needs a platform that spans domains.',
      'Economics weighs less: packaged economics scores reflect each product\'s home scope until buyer TCO is entered.',
      '"Extension beyond initial use case" carries 12% of domain fit for the same reason.',
      'Business criterion weights start as points: 10 for core ontology, integration and control; 7 for major platform domains; 4 for supporting domains. Shares such as 11.111% are the normalized result.'
    ])

    + `<h3 class="gap">Offering scope</h3>`
    + list([
      'Each score rates what the offering delivers natively, as purchased, toward a cross-enterprise operational platform.',
      'Each product has one scope; the report\'s <b>Compare within</b> filter ranks one scope at a time.',
      ...SCOPE_REGISTRY.map(x => `<b>${esc(x.name)}:</b> ${esc(x.description)}`),
      'Engines, databases and frameworks are capped on platform-level criteria: applications, workflow, agent actions, adoption, and the effort to build a platform around them.',
      'Domain application platforms are capped on economics beyond their home domain.',
      'Capped cells are tagged "Rescored for platform scope" and keep their prior score.'
    ])

    + `<h3 class="gap">Calculation</h3>`
    + list([
      'Dimension score: weighted mean of 0-5 criterion scores × 20 (0-100).',
      'Composite: weighted geometric mean of dimension scores (default) or weighted arithmetic mean.',
      'Geometric mean limits how far a strong dimension offsets a weak one.',
      'Evidence-adjusted composite: composite × confidence factor.',
      'Unknown scores count as 0 or are excluded, per the scenario setting.',
      'Economics 5: lowest build and run burden (implementation, stitching, custom code, maintenance, operations). Price sits in the TCO model.'
    ])

    + `<h3 class="gap">Must-have defaults</h3>`
    + list([
      'Each must-have maps to the criterion scores that measure it.',
      `Met: weakest mapped score ${n(mh.met)} or higher.`,
      `Not met: weakest mapped score ${n(mh.notMet)} or lower.`,
      'Not checked: anything in between, or an unscored criterion.',
      'Not applicable: the product\'s scope caps every mapped criterion.',
      'Recorded statuses replace defaults; obtain evidence for every Met before selection.'
    ])
    + `<table><thead><tr><th>Must-have</th><th>Criteria behind the default</th></tr></thead><tbody>${state.gates.map(g => `<tr><td>${esc(g.area)}</td><td>${(g.basis || []).map(b => esc(b.id)).join('; ') || '-'}</td></tr>`).join('')}</tbody></table>`

    + `<h3 class="gap">Risk overlays</h3>`
    + list([
      'Delivery uncertainty, lock-in and buyer-readiness dependency (0-5) are reported beside the composite and excluded from it.',
      'P50/P90 schedule and TCO ranges are reported per product.',
      'Buyer readiness describes your organization and applies to every option.'
    ])

    + `<h3 class="gap">Reading results</h3>`
    + list([
      'Screen with the composite; decide with criterion trade-offs, must-haves, risk and TCO.',
      'Compare within one offering scope and product role.',
      'Domain fit and adoption/value are scenario-specific.',
      'Economics score and quantitative TCO are separate measures.'
    ])

    + `<h3 class="gap">Score provenance</h3>`
    + list([
      'Every packaged product has a score for every criterion.',
      'Status tags mark how decision-ready each score is: Baseline - validate; Workload validation; Buyer cost validation; User input required; Rescored for platform scope.',
      'Technical and product criteria: directional baselines; confirm with current evidence.',
      'Workload-sensitive criteria: confirm with matched tests.',
      'Economics: needs buyer cost evidence. Domain fit: needs the named scenario. Adoption/value: needs buyer-organization input.',
      'New products start blank and are tagged User input required.'
    ])

    + `<h3 class="gap">Adjusting scores</h3>`
    + ol([
      'Unlock editing and open <b>Scores and evidence</b>; choose a dimension and filter to the product.',
      'Change a 0-5 score; it is tagged User-provided - validate and recalculates live.',
      'Change dimension or criterion weights under <b>Set weights</b> (Undo/Redo available).',
      'Record rationale in Product context, costs in Cost, TCO and value, and evidence in Validation plan.',
      'Export JSON to keep everything; CSV, Markdown and Print/PDF are review copies.'
    ])

    + `<h3 class="gap">Verification sequence</h3>`
    + ol([
      'Confirm product scope, edition, deployment and availability.',
      'Check each must-have; obtain evidence for every Met.',
      'Run matched workload tests: latency, throughput, recall, update visibility, concurrency, failure.',
      'Test human, service and agent identities across object, field, path, retrieval and action controls.',
      'Reconstruct lineage and audit from source to recommendation, approval and action.',
      'Test lifecycle changes, backup/restore, bulk export and exit.',
      'Record evidence dates, owners, exceptions and residual risk.'
    ])
    + `</div>`;
}

registerView('methodology', renderMethodology);
