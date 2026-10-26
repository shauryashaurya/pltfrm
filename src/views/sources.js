// Sources: official documentation register with search and product filter
import { state } from '../core/state.js';
import { $, esc } from '../core/format.js';
import { registerView } from '../core/registry.js';
import { expose } from '../core/actions.js';

function sourcesTable(rows) {
  const keys = Object.keys(rows[0] || {});
  return `<div class="matrix-wrap page-flow"><table><thead><tr>${keys.map(k => `<th>${esc(k)}</th>`).join('')}</tr></thead><tbody>${rows.map(r => `<tr>${keys.map(k => { const v = String(r[k] ?? ''); return `<td>${/^https?:/.test(v) ? `<a href="${esc(v)}" target="_blank" rel="noreferrer">Open official documentation</a><br><small>${esc(v)}</small>` : esc(v)}</td>`; }).join('')}</tr>`).join('')}</tbody></table></div>`;
}

// Search matches any column; product filter matches the stack column exactly
function filterSources() {
  const q = ($('sourceSearch').value || '').toLowerCase(), prod = $('sourceProduct').value;
  const rows = (state.sources || []).filter(r => (!prod || (r['Product / stack'] || '') === prod) && (!q || Object.values(r).join(' ').toLowerCase().includes(q)));
  $('sourceRows').innerHTML = sourcesTable(rows);
}

function renderSources() {
  const rows = state.sources || [], products = [...new Set(rows.map(r => r['Product / stack'] || ''))].filter(Boolean).sort();
  $('sources').innerHTML = `<div class="card"><h2>Documentation register</h2><div class="explain"><b>Use:</b> open official references and confirm document currency, GA/preview status, region, edition, deployment and assurance scope at evaluation time.</div><div class="viz-controls no-print"><label>Search<input id="sourceSearch" oninput="PB.filterSources()" placeholder="Product or scope"></label><label>Product<select id="sourceProduct" onchange="PB.filterSources()"><option value="">All products</option>${products.map(x => `<option>${esc(x)}</option>`).join('')}</select></label><button class="btn" type="button" onclick="PB.exportSourcesCSV()">Export source register</button></div><div id="sourceRows">${sourcesTable(rows)}</div></div>`;
}

registerView('sources', renderSources);
expose({ filterSources });
