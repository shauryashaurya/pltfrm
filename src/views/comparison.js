// Product comparison: role, fit and boundary next to the composite score
import { $ } from '../core/format.js';
import { allResults } from '../core/scoring.js';
import { registerView } from '../core/registry.js';
import { rolesTable } from './report.js';

function renderComparison() {
  $('comparison').innerHTML = `<div class="card"><h2>Product comparison</h2><p class="help">Role and boundary show where each offering stops; editors maintain them under Product context.</p>${rolesTable(allResults(), true)}</div>`;
}

registerView('comparison', renderComparison);
