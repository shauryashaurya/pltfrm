// Small formatting and file helpers shared by views and exports
import { state } from './state.js';
import { EXPORT_FOOTER } from '../config.js';

export const $ = id => document.getElementById(id);

// Escape text before it goes into an HTML string
export const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

// Encode a value for use inside a single-quoted inline handler argument (apostrophes too)
export const enc = s => encodeURIComponent(s).replace(/'/g, '%27');

export function n(v) { return Number(v).toFixed(1); }

export function money(v) {
  if (v == null || !isFinite(v)) return '-';
  return new Intl.NumberFormat(undefined, { style: 'currency', currency: state.settings.costCurrency || 'USD', maximumFractionDigits: 0, notation: Math.abs(v) >= 1000000 ? 'compact' : 'standard' }).format(v);
}

// Trigger a file download from text
export function dl(name, text, type = 'text/plain') {
  const a = document.createElement('a');
  a.href = URL.createObjectURL(new Blob([text], { type }));
  a.download = name;
  a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 500);
}

// CSV with a plain header row and quoted cells; a blank line and the attribution row close every file
export function toCSV(headers, rows) {
  const cell = v => '"' + String(v ?? '').replaceAll('"', '""') + '"';
  return headers.join(',') + '\n' + rows.map(r => r.map(cell).join(',')).join('\n') + '\n\n' + cell(EXPORT_FOOTER) + '\n';
}

// Thin progress bar used in the report summary
export function bar(v) { return `<div class="bar"><i style="width:${Math.max(0, Math.min(100, v))}%"></i></div>`; }
