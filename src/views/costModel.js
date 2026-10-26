// Cost, TCO and value: per-product cash assumptions and value realization, plus global cost settings
import { state } from '../core/state.js';
import { $, esc, enc, n, money } from '../core/format.js';
import { product, productOptions, tco, benefits } from '../core/scoring.js';
import { registerView, rerender } from '../core/registry.js';
import { expose } from '../core/actions.js';
import { selectedProduct } from './productMeta.js';

// Every cost edit recomputes this panel and the report
function updateCost(encName, key, value) {
  const p = product(decodeURIComponent(encName));
  if (!p) return;
  p.costModel = p.costModel || {};
  p.costModel[key] = key === 'enabled' ? !!value : (key === 'notes' || key === 'benefitNotes' ? value : +value || 0);
  rerender('costModel', 'report');
}

function setGlobalCost(key, value) { state.settings[key] = value; rerender('costModel', 'report'); }

function renderCostModel() {
  const selected = selectedProduct(), p = product(selected), m = p?.costModel || {}, c = p ? tco(p.name) : {}, e = p ? enc(p.name) : '';
  const num = (key, label, extra = 'min="0"') => `<div><label>${label}</label><input type="number" ${extra} value="${m[key] || 0}" onchange="PB.updateCost('${e}','${key}',this.value)"></div>`;
  const bv = p ? benefits(p.name) : { enabled: false };

  const inputs = p ? `<div class="cost-grid">${num('licenseAnnual', 'Annual license/subscription')}${num('cloudAnnual', 'Annual cloud/infrastructure')}${num('supportAnnual', 'Annual support/services')}${num('implementationOneTime', 'Implementation one-time')}${num('integrationOneTime', 'Integration/stitching one-time')}${num('trainingOneTime', 'Training/change one-time')}${num('ongoingFTE', 'Run/platform FTE', 'min="0" step=".1"')}${num('changeFTE', 'Annual change/enhancement FTE', 'min="0" step=".1"')}${num('otherAnnual', 'Other annual cost')}${num('exitOneTime', 'Exit/migration one-time')}<div class="wide"><label>Assumptions and evidence</label><textarea onchange="PB.updateCost('${e}','notes',this.value)">${esc(m.notes || '')}</textarea></div>`
    + `<div class="wide"><h3>Value realization assumptions</h3></div>${num('annualBenefit', 'Annual gross benefit')}${num('legacySavingsAnnual', 'Annual legacy/tool savings')}<div><label>Benefit ramp (months)</label><input type="number" min="0" max="12" value="${m.benefitRampMonths || 0}" onchange="PB.updateCost('${e}','benefitRampMonths',this.value)"></div><div><label>Benefit confidence (%)</label><input type="number" min="0" max="100" value="${m.benefitConfidence || 50}" onchange="PB.updateCost('${e}','benefitConfidence',this.value)"></div><div class="wide"><label>Benefit assumptions and attribution</label><textarea onchange="PB.updateCost('${e}','benefitNotes',this.value)">${esc(m.benefitNotes || '')}</textarea></div></div>`
    + (bv.enabled ? `<div class="value-grid"><div><b>${money(bv.gross)}</b>${bv.years}-year gross benefit</div><div><b>${money(bv.net)}</b>net value</div><div><b>${bv.roi == null ? '-' : n(bv.roi) + '%'}</b>ROI</div><div><b>${bv.payback == null ? '-' : n(bv.payback) + ' months'}</b>payback</div></div>` : '')
    + `<div class="tco-summary"><div><b>${money(c.oneTime)}</b>one-time build</div><div><b>${money(c.runAnnual)}</b>annual run</div><div><b>${money(c.total)}</b>${c.years || state.settings.costYears}-year cash TCO</div><div><b>${money(c.npv)}</b>discounted NPV</div></div>` : '';

  const s = state.settings;
  $('costModel').innerHTML = `<div class="banner warn reader-only no-print"><div>Your entries update the report in this browser tab only and are cleared when the page reloads. Use <b>Export &gt; Export JSON scenario</b> or <b>Print full report / PDF</b> to keep them.</div></div><div class="card"><h2>Build-vs-buy cost and TCO model</h2><div class="explain"><b>Two complementary measures:</b> the economics rubric scores implementation, stitching, time, control engineering, operations, change, predictability, skills and exit on 0-5. This optional monetary model captures buyer-specific cash assumptions. Do not infer license or staffing amounts from rubric scores.</div><div class="grid2"><div class="form-row"><label>Product</label><select onchange="PB.setFocus(this.value,'costModel')">${productOptions(selected)}</select></div><label><input type="checkbox" ${m.enabled ? 'checked' : ''} onchange="PB.updateCost('${e}','enabled',this.checked)"> Enable quantitative TCO for this product</label></div>${inputs}</div>`
    + `<div class="card"><h2>Global cost assumptions</h2><div class="cost-grid"><div><label>Analysis horizon (years)</label><input type="number" min="1" max="10" value="${s.costYears}" onchange="PB.setGlobalCost('costYears',+this.value)"></div><div><label>Discount rate (%)</label><input type="number" min="0" max="50" step=".1" value="${s.discountRate}" onchange="PB.setGlobalCost('discountRate',+this.value)"></div><div><label>Loaded annual cost per FTE</label><input type="number" min="0" value="${s.loadedFTECost}" onchange="PB.setGlobalCost('loadedFTECost',+this.value)"></div><div><label>Benefit horizon (years)</label><input type="number" min="1" max="10" value="${s.benefitYears}" onchange="PB.setGlobalCost('benefitYears',+this.value)"></div><div><label>Currency</label><input value="${esc(s.costCurrency)}" maxlength="3" onchange="PB.setGlobalCost('costCurrency',this.value.toUpperCase())"></div></div><div class="econ-callout"><b>Required comparability:</b> use the same scope, workload, security/compliance target, service level, staffing basis, change demand, time horizon and contingency across products. Include delays and rework in implementation assumptions rather than treating them as free.</div></div>`;
}

registerView('costModel', renderCostModel);
expose({ updateCost, setGlobalCost });
