// Single source of truth: the study state, seeded from the published baseline
import seedData from '../data/seed.json';

export const seed = seedData;
export let state = structuredClone(seedData);

const replaceHooks = [];

// Modules that cache derived data (e.g. weight undo history) subscribe to whole-state replacement
export function onStateReplaced(fn) { replaceHooks.push(fn); }

// Swap in a new state (load, import, reset), then notify subscribers
export function setState(next) {
  state = next;
  replaceHooks.forEach(fn => fn());
}

export function resetState() { setState(structuredClone(seedData)); }

// Storage helpers never throw; private windows or blocked storage just return null
export function storageGet(store, key) { try { return store.getItem(key); } catch (e) { return null; } }
export function storageSet(store, key, value) { try { store.setItem(key, value); return true; } catch (e) { return false; } }
