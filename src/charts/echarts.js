// ECharts plumbing: views emit placeholder divs with chartSlot(); after each render the queued options mount into them.
// Instances whose element left the page are disposed, so repeated re-renders do not accumulate charts.
import { use, init } from 'echarts/core';
import { BarChart, ScatterChart, HeatmapChart, RadarChart } from 'echarts/charts';
import { RadarComponent, LegendComponent, GridComponent, TooltipComponent, MarkLineComponent, VisualMapComponent, GraphicComponent, AriaComponent } from 'echarts/components';
import { SVGRenderer } from 'echarts/renderers';
import { LabelLayout } from 'echarts/features';
import { onAfterRender } from '../core/registry.js';
import { seriesColors } from '../core/theme.js';
import { esc } from '../core/format.js';
import { expose } from '../core/actions.js';

use([BarChart, ScatterChart, HeatmapChart, RadarChart, RadarComponent, LegendComponent, GridComponent, TooltipComponent, MarkLineComponent, VisualMapComponent, GraphicComponent, AriaComponent, LabelLayout, SVGRenderer]);

const queue = new Map();  // key -> option builder, filled while views build their HTML
const live = new Map();   // key -> { el, chart, ro }
const PRINT_WIDTH = 640;  // chart width on an A4/Letter page inside a card

// Placeholder for one chart; build(t) receives the theme and returns the ECharts option
export function chartSlot(key, build, height = 360) {
  queue.set(key, build);
  return `<div class="echart" data-chart="${esc(key)}" style="height:${height}px"></div>`;
}

// Colors and font from the CSS tokens, so charts follow the light/dark theme
export function theme() {
  const cs = getComputedStyle(document.documentElement), v = k => cs.getPropertyValue(k).trim();
  return {
    text: v('--text'), muted: v('--muted'), line: v('--line'), lineStrong: v('--line-strong'), surface: v('--surface'), surface2: v('--surface-2'), track: v('--track'),
    tipBg: v('--tip-bg'), tipText: v('--tip-text'), blue: v('--c-blue'), green: v('--c-green'), amber: v('--c-amber'), red: v('--c-red'), gray: v('--c-gray'),
    goodText: v('--good-text'), badText: v('--bad-text'), font: v('--font'), series: seriesColors()
  };
}

// Options every chart shares: font, accessible description, no animation on re-render, tooltip styled like .tooltip.
// A chart's own tooltip settings (trigger, formatter) merge into the shared style rather than replacing it.
export function base(t, option) {
  const tooltip = { className: 'ec-tooltip', transitionDuration: 0, backgroundColor: t.tipBg, borderWidth: 0, padding: [7, 9], textStyle: { color: t.tipText, fontFamily: t.font, fontSize: 11.5 }, extraCssText: 'border-radius:0;box-shadow:0 4px 14px rgba(0,0,0,.18);max-width:280px;white-space:normal;line-height:1.35;z-index:10000' };
  return {
    aria: { enabled: true }, animation: false,
    textStyle: { fontFamily: t.font, color: t.text },
    ...option,
    tooltip: { ...tooltip, ...(option.tooltip || {}) }
  };
}

// Axis presets in theme colors
export const valueAxis = (t, extra = {}) => ({ type: 'value', axisLine: { show: false }, axisTick: { show: false }, axisLabel: { color: t.muted, fontSize: 11 }, splitLine: { lineStyle: { color: t.line } }, nameTextStyle: { color: t.text, fontSize: 12 }, ...extra });
export const categoryAxis = (t, data, extra = {}) => ({ type: 'category', data, axisLine: { lineStyle: { color: t.lineStrong } }, axisTick: { show: false }, axisLabel: { color: t.text, fontSize: 12 }, ...extra });

// Tooltips live on <body> so cards with overflow cannot clip them or stack above them;
// they open beside the pointer and flip to the other side near a viewport edge
function viewportTooltip(option, el) {
  if (!option.tooltip) return option;
  const position = (point, params, dom, rect, size) => {
    const r = el.getBoundingClientRect(), [w, h] = size.contentSize, gap = 14, edge = 8;
    let x = r.left + point[0] + gap, y = r.top + point[1] + gap;
    if (x + w > innerWidth - edge) x = r.left + point[0] - w - gap;
    if (y + h > innerHeight - edge) y = r.top + point[1] - h - gap;
    return [Math.max(edge, x) - r.left, Math.max(edge, y) - r.top];
  };
  return { ...option, tooltip: { ...option.tooltip, appendTo: 'body', confine: false, position } };
}

function mount(key, el, build, t) {
  const entry = { el, chart: null, ro: null };
  const start = () => { entry.chart = init(el, null, { renderer: 'svg' }); entry.chart.setOption(viewportTooltip(build(t), el)); };
  // Panels hidden at render time have no width yet; start the chart once it becomes visible
  entry.ro = new ResizeObserver(() => { if (!el.clientWidth) return; if (entry.chart) entry.chart.resize(); else start(); });
  entry.ro.observe(el);
  if (el.clientWidth) start();
  live.set(key, entry);
}

function drop(key) {
  const e = live.get(key);
  if (!e) return;
  e.ro.disconnect();
  e.chart?.dispose();
  live.delete(key);
}

function mountCharts() {
  for (const [key, e] of live) if (!e.el.isConnected) drop(key);
  if (!queue.size) return;
  const t = theme();
  for (const [key, build] of queue) {
    const el = document.querySelector(`.echart[data-chart="${CSS.escape(key)}"]`);
    if (!el) continue;
    drop(key);
    mount(key, el, build, t);
  }
  queue.clear();
}

onAfterRender(mountCharts);

// Print lays the page out narrower than the screen; size charts for the page, then restore
addEventListener('beforeprint', () => live.forEach(e => e.chart?.resize({ width: Math.min(PRINT_WIDTH, e.el.clientWidth || PRINT_WIDTH) })));
addEventListener('afterprint', () => live.forEach(e => e.chart?.resize()));

// Count of mounted charts, for checking that re-renders do not leak instances
export const liveChartCount = () => live.size;
expose({ liveChartCount });
