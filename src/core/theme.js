// Light-warm / cool-dark theme switching and theme-aware chart series colors
import { $ } from './format.js';
import { storageSet } from './state.js';

// Series colors come from CSS tokens so charts follow the active theme
export function seriesColors() {
  const cs = getComputedStyle(document.documentElement);
  return [1, 2, 3, 4, 5, 6, 7].map(i => cs.getPropertyValue('--s' + i).trim() || '#7F9DBF');
}

export function currentTheme() { return document.documentElement.getAttribute('data-theme') === 'dark' ? 'dark' : 'light'; }

// Apply a theme, remember it, and update the toggle label
export function applyTheme(theme) {
  document.documentElement.setAttribute('data-theme', theme);
  const b = $('themeToggle');
  b.textContent = theme === 'dark' ? 'Light theme' : 'Dark theme';
  b.setAttribute('aria-pressed', String(theme === 'dark'));
  storageSet(localStorage, 'playbookTheme', theme);
}

// Toggle, then let the caller re-render charts that read series colors
export function initThemeToggle(onChange) {
  applyTheme(currentTheme());
  $('themeToggle').addEventListener('click', () => { applyTheme(currentTheme() === 'dark' ? 'light' : 'dark'); onChange(); });
}
