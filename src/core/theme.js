// Light-warm / cool-dark theme switching and theme-aware chart series colors
import { $ } from './format.js';
import { storageSet } from './state.js';

// Series colors come from CSS tokens so charts follow the active theme
export function seriesColors() {
  const cs = getComputedStyle(document.documentElement);
  return [1, 2, 3, 4, 5, 6, 7].map(i => cs.getPropertyValue('--s' + i).trim() || '#7F9DBF');
}

export function currentTheme() { return document.documentElement.getAttribute('data-theme') === 'dark' ? 'dark' : 'light'; }

const SVG = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">';
const MOON = SVG + '<path d="M21 12.8A9 9 0 1 1 11.2 3a7 7 0 0 0 9.8 9.8z"/></svg>';
const SUN = SVG + '<circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4"/></svg>';

// Apply a theme, remember it, and update the toggle icon and label
export function applyTheme(theme) {
  document.documentElement.setAttribute('data-theme', theme);
  const b = $('themeToggle'), label = theme === 'dark' ? 'Switch to light theme' : 'Switch to dark theme';
  b.innerHTML = theme === 'dark' ? SUN : MOON;
  b.setAttribute('aria-label', label);
  b.title = label;
  b.setAttribute('aria-pressed', String(theme === 'dark'));
  storageSet(localStorage, 'playbookTheme', theme);
}

// Toggle, then let the caller re-render charts that read series colors
export function initThemeToggle(onChange) {
  applyTheme(currentTheme());
  $('themeToggle').addEventListener('click', () => { applyTheme(currentTheme() === 'dark' ? 'light' : 'dark'); onChange(); });
}
