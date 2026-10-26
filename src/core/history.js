// Undo/redo for weights: snapshots of dimension and criterion weights taken at each committed change
import { state, onStateReplaced } from './state.js';

let committed = null;
const undoStack = [];
const redoStack = [];
const LIMIT = 100;

function snapshot() {
  return JSON.stringify({ dims: state.dimensionWeights, crit: Object.fromEntries(Object.entries(state.criteria).map(([d, cs]) => [d, cs.map(c => c.weight)])) });
}

function restore(snap) {
  const s = JSON.parse(snap);
  state.dimensionWeights = s.dims;
  Object.entries(s.crit).forEach(([d, ws]) => ws.forEach((w, i) => { if (state.criteria[d]?.[i]) state.criteria[d][i].weight = w; }));
}

// Start a fresh history from the current weights (on load, import, reset)
export function resetHistory() { committed = snapshot(); undoStack.length = 0; redoStack.length = 0; }

// Record a finished edit: the previous committed snapshot becomes undoable
export function commitWeights() {
  const now = snapshot();
  if (committed === null) { committed = now; return; }
  if (now === committed) return;
  undoStack.push(committed);
  if (undoStack.length > LIMIT) undoStack.shift();
  redoStack.length = 0;
  committed = now;
}

export function undoWeights() {
  if (!undoStack.length) return false;
  redoStack.push(snapshot());
  restore(undoStack.pop());
  committed = snapshot();
  return true;
}

export function redoWeights() {
  if (!redoStack.length) return false;
  undoStack.push(snapshot());
  restore(redoStack.pop());
  committed = snapshot();
  return true;
}

export function historyState() { return { canUndo: undoStack.length > 0, canRedo: redoStack.length > 0, undoCount: undoStack.length }; }

onStateReplaced(resetHistory);
