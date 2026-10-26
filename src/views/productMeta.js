// Product context editor: category, role, fit, boundary and evaluator notes for one product
import { state } from '../core/state.js';
import { $, esc, enc } from '../core/format.js';
import { product, productOptions } from '../core/scoring.js';
import { registerView, rerender } from '../core/registry.js';
import { expose } from '../core/actions.js';

// The focus product is shared with the cost and risk editors
function selectedProduct() { return product(state.settings.focusProduct) ? state.settings.focusProduct : state.products[0]?.name; }

function setFocus(name, viewId) { state.settings.focusProduct = name; rerender(viewId); }

function updateProductMeta(encName, key, value) {
  const p = product(decodeURIComponent(encName));
  if (p) p[key] = value;
  rerender('comparison', 'report');
}

function renderProductMeta() {
  const selected = selectedProduct(), p = product(selected), field = (key, label) => `<div class="wide"><label>${label}</label><textarea onchange="PB.updateProductMeta('${enc(p.name)}','${key}',this.value)">${esc(p[key] || '')}</textarea></div>`;
  $('productMeta').innerHTML = `<div class="card"><h2>Product metadata and qualitative context</h2><div class="explain"><b>Purpose:</b> scores cannot describe product role, implementation boundary or evidence caveats. Maintain these fields with every product so the report retains the context behind the numbers.</div><div class="form-row"><label>Product</label><select onchange="PB.setFocus(this.value,'productMeta')">${productOptions(selected)}</select></div>${p ? `<div class="product-form"><div><label>Name</label><input value="${esc(p.name)}" disabled></div><div><label>Category / product role group</label><input value="${esc(p.category)}" onchange="PB.updateProductMeta('${enc(p.name)}','category',this.value)"></div>${field('role', 'Primary role')}${field('fit', 'Representative fit')}${field('boundary', 'Boundary / verification need')}${field('notes', 'Evaluator notes')}</div>` : '<div class="notice">No included product is available.</div>'}</div>`;
}

registerView('productMeta', renderProductMeta);
expose({ setFocus, updateProductMeta });
export { selectedProduct };
