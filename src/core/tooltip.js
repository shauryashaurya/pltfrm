// Hover tooltips for chart marks and table cells
import { $, esc, n } from './format.js';
import { allResults, resultByName } from './scoring.js';
import { expose } from './actions.js';

// Standard product summary shown when hovering any product mark
export function tipText(r) {
  if (!r) return 'No data';
  return `<b>${esc(r.name)}</b><br>${esc(r.category)}<br>Technical ${n(r.t)} | Business ${n(r.b)} | AI ${n(r.a)} | Economics ${n(r.o)} | Domain ${n(r.d)} | Adoption ${n(r.v)} | 6D ${n(r.c)}<br>Scale ${n(r.scale)} | Enterprise ${n(r.enterprise)}<br>Confidence ${r.confidence}; must-haves met/not met/unchecked ${r.gates.pass}/${r.gates.fail}/${r.gates.unknown}`;
}

// Escape a tooltip HTML string for a single-quoted inline handler; &#39; would decode back to a quote, so use a JS escape
export const tipArg = html => html.replace(/\\/g, '\\\\').replace(/'|&#39;/g, '\\x27');

function moveTip(evt) {
  const t = $('tooltip'), x = Math.min(innerWidth - t.offsetWidth - 12, evt.clientX + 14), y = Math.min(innerHeight - t.offsetHeight - 12, evt.clientY + 14);
  t.style.left = Math.max(5, x) + 'px';
  t.style.top = Math.max(5, y) + 'px';
}

function showTip(evt, html) { const t = $('tooltip'); t.innerHTML = html; t.style.display = 'block'; moveTip(evt); }
function hideTip() { $('tooltip').style.display = 'none'; }

// Look up the product by encoded name at hover time so the tooltip reflects current scores
function tipProduct(evt, encName) { showTip(evt, tipText(resultByName(allResults(), decodeURIComponent(encName)))); }

document.addEventListener('mousemove', e => { if ($('tooltip').style.display === 'block') moveTip(e); });

expose({ showTip, hideTip, tipProduct });
