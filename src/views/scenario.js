// Step 1 controls: study title, scenario text and scoring rules, bound to state.settings
import { state } from '../core/state.js';
import { $, esc } from '../core/format.js';
import { registerView, rerender, renderAll } from '../core/registry.js';

// Header title: text before the first colon is the wordmark, the rest is the tagline
function setTitle(text) {
  const t = String(text || '').trim(), i = t.indexOf(':');
  $('title').innerHTML = i > 0 ? `<span class="wordmark">${esc(t.slice(0, i))}</span><span class="tagline">${esc(t.slice(i + 1).trim())}</span>` : `<span class="tagline">${esc(t)}</span>`;
  document.title = t || 'PLTFRM';
}

// Push state values into the form (after load, import or reset)
function renderScenario() {
  const s = state.settings;
  setTitle(state.studyTitle);
  $('studyTitle').value = state.studyTitle;
  $('scenarioName').value = s.scenarioName;
  $('industry').value = s.industry;
  $('priorityUseCases').value = s.priorityUseCases;
  $('method').value = s.compositeMethod;
  $('unknown').value = s.unknownScoreTreatment;
  $('threshold').value = s.shortlistThreshold;
  $('riskToggle').checked = s.showEvidenceAdjusted;
}

// Form edits write back to state; text edits refresh the report, scoring rules refresh everything
export function bindScenario() {
  $('studyTitle').addEventListener('input', e => { state.studyTitle = e.target.value; setTitle(e.target.value); });
  [['scenarioName', 'scenarioName'], ['industry', 'industry'], ['priorityUseCases', 'priorityUseCases']].forEach(([id, key]) => $(id).addEventListener('input', e => { state.settings[key] = e.target.value; rerender('report'); }));
  $('method').addEventListener('change', e => { state.settings.compositeMethod = e.target.value; renderAll(); });
  $('unknown').addEventListener('change', e => { state.settings.unknownScoreTreatment = e.target.value; renderAll(); });
  $('threshold').addEventListener('input', e => { state.settings.shortlistThreshold = +e.target.value; rerender('report'); });
  $('riskToggle').addEventListener('change', e => { state.settings.showEvidenceAdjusted = e.target.checked; rerender('report'); });
}

registerView('scenario', renderScenario);
