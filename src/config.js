// App-wide settings. Change these before deploying.

// Attribution line added to the end of every export (CSV, JSON, Markdown); print.css carries the same text for PDF pages
export const EXPORT_FOOTER = 'PLTFRM | © 2026 Shaurya Agarwal';

// SHA-256 of the editor passphrase (default: playbook-editor-2026). Generate a new one with: npm run hash-passphrase -- "new phrase"
export const EDITOR_PASSPHRASE_SHA256 = '6077fc2bebc47f81f39abb313c858441dfec035295c0ff560e17de34925bfb5d';

// Plain-language labels for must-have statuses; stored values stay Pass/Fail/Unknown/N/A for file compatibility
export const MUST_HAVE_LABELS = { Pass: 'Met', Fail: 'Not met', Unknown: 'Not checked', 'N/A': 'Not applicable' };
export const MUST_HAVE_VALUES = ['Unknown', 'Pass', 'Fail', 'N/A'];
export const mustHaveLabel = v => MUST_HAVE_LABELS[v] || v;

// Weight presets: dimension weights plus any criterion weights that differ from the seed
export const WEIGHT_PRESETS = {
  'cross-enterprise': {
    label: 'Cross-enterprise platform (default)',
    dimensions: { technical: 20, business: 20, ai: 12, economics: 16, domain: 24, adoption: 8 },
    criteria: { domain: { 'Priority use-case fit': 20, 'Industry/domain data-model maturity': 10, 'Domain applications and reusable patterns': 12, 'Comparable production references': 9, 'Operational workflow and decision-cadence fit': 12, 'Domain-specific data and relationship support': 8, 'Domain regulatory and security fit': 6, 'Real-time and event requirement fit': 6, 'Analytics simulation and optimization fit': 5, 'Extension beyond initial use case': 12 } }
  },
  'single-domain': {
    label: 'Single-domain deployment',
    dimensions: { technical: 22, business: 17, ai: 13, economics: 20, domain: 18, adoption: 10 },
    criteria: { domain: { 'Priority use-case fit': 20, 'Industry/domain data-model maturity': 12, 'Domain applications and reusable patterns': 12, 'Comparable production references': 12, 'Operational workflow and decision-cadence fit': 12, 'Domain-specific data and relationship support': 8, 'Domain regulatory and security fit': 8, 'Real-time and event requirement fit': 6, 'Analytics simulation and optimization fit': 5, 'Extension beyond initial use case': 5 } }
  }
};

// Local storage keys; older keys are still read so earlier saves load
export const STORAGE_KEY = 'platformStudyV8';
export const LEGACY_STORAGE_KEYS = ['platformStudyV7', 'platformStudyV61', 'platformStudyV6', 'platformStudyV5', 'platformStudyV4', 'platformStudyV3', 'platformStudyV2', 'platformStudy'];
