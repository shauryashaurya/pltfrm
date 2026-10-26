// Render registry: each view registers under its panel id; rerender() refreshes views then runs shell hooks
import { esc } from './format.js';

const views = {};
const afterHooks = [];

export function registerView(id, fn) { views[id] = fn; }
export function onAfterRender(fn) { afterHooks.push(fn); }

// A failing view shows an error card in its own panel instead of breaking the page
function safeRender(id) {
  try { views[id]?.(); }
  catch (err) {
    console.error(id, err);
    const panel = document.getElementById(id);
    if (panel) panel.innerHTML = `<div class="card"><h2>${esc(id)}</h2><div class="notice bad"><b>This section could not render.</b><br>${esc(err?.message || String(err))}</div><p>Reset the packaged baseline or import a valid scenario. Other sections remain available.</p></div>`;
  }
}

export function rerender(...ids) {
  ids.forEach(safeRender);
  afterHooks.forEach(fn => fn());
}

// Full refresh in registration order (controls first, then panels)
export function renderAll() { rerender(...Object.keys(views)); }
