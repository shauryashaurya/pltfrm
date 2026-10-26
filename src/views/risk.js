// Risk and readiness: decision-risk overlays per product and the buyer-readiness rubric
import { state } from '../core/state.js';
import { $, esc, enc, n } from '../core/format.js';
import { product, productOptions, riskClass, buyerReadinessScore } from '../core/scoring.js';
import { registerView, rerender } from '../core/registry.js';
import { expose } from '../core/actions.js';
import { selectedProduct } from './productMeta.js';

function updateRisk(encName, key, value) {
  const p = product(decodeURIComponent(encName));
  if (!p) return;
  p.riskOverlay = p.riskOverlay || {};
  p.riskOverlay[key] = key === 'notes' ? value : +value || 0;
  rerender('risk', 'report');
}

function setReadiness(encId, value) { state.buyerReadiness.scores[decodeURIComponent(encId)] = +value; rerender('risk', 'report'); }
function setReadinessNotes(value) { state.buyerReadiness.notes = value; }

function renderRisk() {
  const selected = selectedProduct(), p = product(selected), r = p?.riskOverlay || {}, e = p ? enc(p.name) : '';
  const card = (key, label) => `<div class="risk-card"><label>${label}</label><input type="number" min="0" max="5" step=".1" value="${r[key] || 0}" onchange="PB.updateRisk('${e}','${key}',this.value)"><b class="${riskClass(r[key])}">${n(r[key] || 0)}</b></div>`;
  const num = (key, label, step, fallback) => `<div><label>${label}</label><input type="number" min="0" step="${step}" value="${r[key] || fallback}" onchange="PB.updateRisk('${e}','${key}',this.value)"></div>`;

  const overlays = p ? `<div class="risk-grid">${card('deliveryUncertainty', 'Delivery uncertainty (0-5)')}${card('concentrationRisk', 'Concentration/lock-in risk (0-5)')}${card('buyerReadinessDependency', 'Buyer-readiness dependency (0-5)')}</div><div class="cost-grid">${num('p50Months', 'P50 delivery months', '.5', 0)}${num('p90Months', 'P90 delivery months', '.5', 0)}${num('lowTcoFactor', 'Low TCO factor', '.05', .85)}${num('highTcoFactor', 'High TCO factor', '.05', 1.35)}<div class="wide"><label>Risk evidence and mitigations</label><textarea onchange="PB.updateRisk('${e}','notes',this.value)">${esc(r.notes || '')}</textarea></div></div>` : '<div class="notice">No included product is available. Add or include a product first.</div>';

  const b = state.buyerReadiness;
  $('risk').innerHTML = `<div class="card"><h2>Decision-risk overlays</h2><div class="explain"><b>Not part of the composite:</b> delivery uncertainty, concentration/lock-in and buyer-readiness dependency are shown separately so expected capability is not confused with uncertainty or buyer conditions. Risk uses 0 low to 5 high.</div><div class="form-row"><label>Product</label><select onchange="PB.setFocus(this.value,'risk')">${productOptions(selected)}</select></div>${overlays}</div>`
    + `<div class="card"><h2>Buyer and data readiness</h2><div class="explain"><b>Buyer-specific overlay:</b> this affects schedule, cost confidence and benefit realization, not intrinsic product capability. Baseline 3 means moderate readiness.</div><div class="metric"><b>${n(buyerReadinessScore())}</b><span>Buyer readiness /100</span></div><div class="readiness-grid">${b.criteria.map(c => `<div class="form-row"><label title="${esc(c.description)}">${esc(c.name)} <small>${n(c.weight)}%</small></label><input type="number" min="0" max="5" step=".1" value="${b.scores[c.id]}" onchange="PB.setReadiness('${enc(c.id)}',this.value)"></div>`).join('')}</div><label>Readiness notes</label><textarea onchange="PB.setReadinessNotes(this.value)">${esc(b.notes || '')}</textarea></div>`;
}

registerView('risk', renderRisk);
expose({ updateRisk, setReadiness, setReadinessNotes });
