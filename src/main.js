// Entry point: load styles, register views (order = render order), bind controls, then route
import './styles/tokens.css';
import './styles/base.css';
import './styles/layout.css';
import './styles/components.css';
import './styles/charts.css';
import './styles/print.css';

import { $ } from './core/format.js';
import { renderAll, rerender } from './core/registry.js';
import { expose } from './core/actions.js';
import { initThemeToggle } from './core/theme.js';
import './core/tooltip.js';

// Editor controls register first so their inputs are filled before panels render
import { bindScenario } from './views/scenario.js';
import { bindWeights } from './views/weights.js';
import { bindProducts } from './views/products.js';

// Panels
import './views/report.js';
import './views/comparison.js';
import './views/productMeta.js';
import './views/costModel.js';
import './views/risk.js';
import './views/scores.js';
import './views/mustHaves.js';
import './views/methodology.js';
import './views/validation.js';
import './views/sources.js';

import { importFile } from './exports/files.js';
import './exports/markdown.js';
import './shell/rail.js';
import { routeFromHash, openPanel } from './shell/router.js';

// Print always shows the report (step 6 for editors); browsers that block printing ignore the call
function printFullReport() { openPanel('report'); setTimeout(() => window.print(), 150); }

// Close the export menu on outside clicks and after choosing an item
function bindExportMenu() {
  document.addEventListener('click', e => {
    const m = $('exportMenu');
    if (m.open && (!m.contains(e.target) || e.target.closest('.menu-list button'))) m.open = false;
  }, true);
}

bindScenario();
bindWeights();
bindProducts();
bindExportMenu();
$('importFile').addEventListener('change', e => { importFile(e.target.files[0]); e.target.value = ''; });
initThemeToggle(() => rerender('report'));
expose({ printFullReport });

renderAll();
routeFromHash();
