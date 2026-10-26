// Product comparison: role, fit and boundary next to the 6D score
import { $, esc, n } from '../core/format.js';
import { allResults } from '../core/scoring.js';
import { registerView } from '../core/registry.js';

function renderComparison() {
  const rows = allResults();
  $('comparison').innerHTML = `<div class="card"><h2>Comprehensive product comparison</h2><p class="help">Product role and boundary prevent a component engine from being read as a complete operational-platform substitute. Editors maintain this context under Product context.</p><div class="matrix-wrap page-flow"><table class="comparison-table"><thead><tr><th>Offering</th><th>Category</th><th>Primary role</th><th>Representative fit</th><th>Boundary / verification need</th><th>6D</th></tr></thead><tbody>${rows.map(r => `<tr><td><b>${esc(r.name)}</b></td><td>${esc(r.category)}</td><td>${esc(r.role)}</td><td>${esc(r.fit)}</td><td>${esc(r.boundary)}</td><td class="num score">${n(r.c)}</td></tr>`).join('')}</tbody></table></div></div>`;
}

registerView('comparison', renderComparison);
