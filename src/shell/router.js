// Navigation: reader mode (default, opens on the report) and editor mode (passphrase, six guided steps)
import { $ } from '../core/format.js';
import { rerender } from '../core/registry.js';
import { expose } from '../core/actions.js';
import { isEditor, unlock, lock } from '../core/auth.js';
import { askPassphrase, notify } from '../ui/dialog.js';

// Panels readers can open; everything else needs editor mode. Must-haves and cost feed the report, so readers can work them through too
export const READER_PANELS = ['report', 'comparison', 'mustHaves', 'costModel', 'methodology', 'validation', 'sources'];
const STEP_PANELS = { 1: [], 2: ['productMeta', 'comparison'], 3: [], 4: ['scores', 'validation', 'sources'], 5: ['mustHaves', 'costModel', 'risk'], 6: ['report', 'methodology'] };
const lastPanel = { 2: 'productMeta', 4: 'scores', 5: 'mustHaves', 6: 'report' };
let mode = 'reader';

export const currentMode = () => mode;

// Panels live in one place at a time: the reader host or their step's slot
function placePanels() {
  if (mode === 'reader') READER_PANELS.forEach(id => $('readerHost').appendChild($(id)));
  else document.querySelectorAll('[data-slot]').forEach(slot => slot.appendChild($(slot.dataset.slot)));
}

// Show one panel, mark its tab, and render it fresh
function activate(panelId) {
  document.querySelectorAll('.panel').forEach(p => p.classList.toggle('active', p.id === panelId));
  document.querySelectorAll('.tab').forEach(t => t.classList.toggle('active', t.dataset.id === panelId));
  if (panelId) rerender(panelId);
}

function setHash(token) { try { history.replaceState(null, '', '#' + token); } catch (e) { /* hash is optional */ } }

export function showReader(panel = 'report') {
  if (!READER_PANELS.includes(panel)) panel = 'report';
  mode = 'reader';
  document.body.dataset.mode = 'reader';
  placePanels();
  activate(panel);
  setHash('view-' + panel);
  window.scrollTo(0, 0);
}

export function showStep(step, panel) {
  if (!isEditor()) { showReader('report'); return; }
  mode = 'edit';
  document.body.dataset.mode = 'edit';
  placePanels();
  document.querySelectorAll('.step').forEach(s => { s.hidden = +s.dataset.step !== step; });
  document.querySelectorAll('.step-link').forEach(b => { const on = +b.dataset.step === step; b.classList.toggle('current', on); on ? b.setAttribute('aria-current', 'step') : b.removeAttribute('aria-current'); });
  document.querySelector('.step-link.current')?.scrollIntoView?.({ block: 'nearest', inline: 'nearest' });
  document.body.classList.toggle('wide', step === 6);
  if (panel) lastPanel[step] = panel;
  activate(lastPanel[step]);
  setHash('edit-' + step);
  window.scrollTo(0, 0);
}

// Open a panel wherever it lives in the current mode
export function openPanel(panel) {
  if (mode === 'edit') {
    const step = Object.keys(STEP_PANELS).find(k => STEP_PANELS[k].includes(panel));
    if (step) showStep(+step, panel);
  } else showReader(panel);
}

// Editing needs the passphrase once per browser tab
async function startEditing() {
  if (!isEditor()) {
    const pass = await askPassphrase();
    if (pass === null) return;
    try {
      if (!await unlock(pass)) { notify('That passphrase is not correct.'); return; }
    } catch (err) { notify(err.message); return; }
    notify('Editing unlocked for this tab.');
  }
  showStep(1);
}

function stopEditing() { lock(); showReader('report'); notify('Editing locked. Showing the report.'); }

// Deep links: #view-report, #view-comparison ... for readers; #edit-1 ... #edit-6 for editors (tokens never match element ids, so the browser does not jump)
export function routeFromHash() {
  const h = location.hash.slice(1), m = h.match(/^edit-([1-6])$/);
  if (m && isEditor()) showStep(+m[1]);
  else showReader(h.replace(/^view-/, '') || 'report');
}

expose({ showStep, showReader, openPanel, startEditing, stopEditing });
