// Live status after every render: ranking rail, readiness checklist, step labels and the open items in the report's note
import { state } from '../core/state.js';
import { $, esc, n } from '../core/format.js';
import { allResults, displayValue, scoreCoverage } from '../core/scoring.js';
import { onAfterRender } from '../core/registry.js';
import { currentMode, READER_PANELS } from './router.js';

// Readiness = the five things that make the result decision-ready
function readiness(rows) {
  const s = state.settings, ps = state.products.filter(p => !p.hidden), cov = scoreCoverage(), th = +s.shortlistThreshold || 0;
  let checksTotal = ps.length * state.gates.length, checksDone = 0;
  ps.forEach(p => state.gates.forEach((g, i) => { if (((state.gateStatus[p.name] || {})[i] || 'Unknown') !== 'Unknown') checksDone++; }));
  const shortlist = rows.filter(r => displayValue(r) >= th && !r.gates.fail), costed = shortlist.filter(r => r.cost.enabled).length;
  const framed = [s.scenarioName, s.industry, s.priorityUseCases].every(v => String(v || '').trim());
  const checks = [
    { ok: framed, text: framed ? 'Scenario, method and threshold set' : 'Scenario name, industry or use cases missing', step: 1 },
    { ok: ps.length >= 2, text: `${ps.length} products included`, step: 2 },
    { ok: cov.user === 0, text: cov.user ? `<b>${cov.user}</b> score cells still need input` : 'No score cells awaiting input', step: 4, panel: 'scores' },
    { ok: checksDone === checksTotal, text: `<b>${checksDone} of ${checksTotal}</b> must-have checks recorded`, step: 5, panel: 'mustHaves' },
    { ok: shortlist.length > 0 && costed === shortlist.length, text: `Cost modeled for <b>${costed} of ${shortlist.length}</b> shortlisted products`, step: 5, panel: 'costModel' }
  ];
  return { ps, cov, checksTotal, checksDone, shortlist, costed, framed, checks, failed: rows.filter(r => r.gates.fail).length, provisional: checks.some(c => !c.ok) };
}

function setStepStatus(step, text, ok) { const e = $('st-' + step); if (e) { e.textContent = text; e.className = 'st ' + (ok ? 'done' : 'warn'); } }

function renderStatus() {
  const rows = allResults(), s = state.settings, th = +s.shortlistThreshold || 0, R = readiness(rows);
  const sorted = [...rows].sort((a, b) => displayValue(b) - displayValue(a));

  // Ranking rail: top 10 by the displayed value with a threshold marker
  $('railRank').innerHTML = `<p class="rail-lead"><b>${R.shortlist.length} of ${rows.length}</b> clear the threshold of ${th} on the ${s.showEvidenceAdjusted ? 'evidence-adjusted' : 'raw'} 6D score with no must-have missed.</p><ol class="rank">${sorted.slice(0, 10).map((r, i) => { const v = displayValue(r), inn = v >= th && !r.gates.fail; return `<li class="${inn ? 'in' : 'out'}"><span class="pos">${i + 1}</span><span class="nm" title="${esc(r.name)}">${esc(r.name)}${r.gates.fail ? ' <em class="flag">must-have not met</em>' : ''}</span><span class="v">${n(v)}</span><span class="track"><i style="width:${Math.max(0, Math.min(100, v))}%"></i><b style="left:${Math.max(0, Math.min(100, th))}%"></b></span></li>`; }).join('')}</ol><p class="rail-note">Dark marker = threshold ${th}. Grey bars fall below it.</p>`;

  // Readiness checklist with jump links to the step that fixes each item
  $('railReady').innerHTML = `<ul class="checklist">${R.checks.map(c => `<li><span class="ic ${c.ok ? 'done' : 'warn'}" aria-hidden="true">${c.ok ? '&#10003;' : '!'}</span><span>${c.text}${c.ok ? '' : ` <button class="linkish" type="button" onclick="PB.showStep(${c.step}${c.panel ? `,'${c.panel}'` : ''})">Fix</button>`}</span></li>`).join('')}</ul>${R.failed ? `<p class="rail-note">${R.failed} product(s) miss a must-have and are excluded from the shortlist.</p>` : ''}<div class="banner ${R.provisional ? 'warn' : 'good'}">${R.provisional ? 'The report is marked Provisional until these items are resolved.' : 'All readiness checks pass.'}</div>`;

  const dw = Object.values(state.dimensionWeights).reduce((a, b) => a + (+b || 0), 0);
  setStepStatus(1, R.framed ? 'Done' : 'Needs input', R.framed);
  setStepStatus(2, `${R.ps.length} included`, R.ps.length >= 2);
  setStepStatus(3, Math.abs(dw - 100) < .2 ? 'Total 100%' : `Total ${n(dw)}, normalized`, true);
  setStepStatus(4, R.cov.user ? `${R.cov.user} cells need input` : 'Inputs complete', !R.cov.user);
  setStepStatus(5, `${R.checksDone}/${R.checksTotal} checks, ${R.costed}/${R.shortlist.length} costed`, R.checksDone === R.checksTotal && R.costed === R.shortlist.length);
  setStepStatus(6, R.provisional ? 'Provisional' : 'Ready', !R.provisional);

  // Plain-language status in the report's closing note; items readers can act on link to their tab
  const slot = $('reportOpenItems');
  if (slot) {
    const link = c => c.panel && (currentMode() === 'edit' || READER_PANELS.includes(c.panel)) ? `${c.text} <button class="linkish" type="button" onclick="PB.openPanel('${c.panel}')">Open</button>` : c.text;
    slot.innerHTML = R.provisional
      ? `<div class="banner warn"><div><b>Provisional result.</b> Still open:<ul>${R.checks.filter(c => !c.ok).map(c => `<li>${link(c)}</li>`).join('')}</ul></div></div>`
      : `<div class="banner good"><div><b>Decision-ready.</b> Every readiness check is complete.</div></div>`;
  }
}

onAfterRender(renderStatus);
