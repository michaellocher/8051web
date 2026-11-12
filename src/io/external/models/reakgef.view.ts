import { el } from '../../kit.ts';
import type { ExternalModelDef, ModelView } from '../frame.ts';
import { P_BURST, P_HIGH, P_LOW, T_HIGH, T_LOW, T_RUNAWAY, ReakgefLogic } from './reakgef.logic.ts';
import { lamp, panelButton } from './parts.ts';
import { bow, rc, tx } from './p2.parts.ts';

const rad = (deg: number) => (deg * Math.PI) / 180;
const arc = (cx: number, cy: number, r: number, a1: number, a2: number) =>
  `M${cx + r * Math.sin(rad(a1))} ${cy - r * Math.cos(rad(a1))} A${r} ${r} 0 0 1 ${cx + r * Math.sin(rad(a2))} ${cy - r * Math.cos(rad(a2))}`;
const ang = (v: number, max: number) => -60 + 120 * Math.min(1, Math.max(0, v / max));

/** Zeigerinstrument: Skala 0..max, rote Zone ab `red`, gelbe Zone bis `low` */
function gauge(svg: SVGSVGElement, x: number, y: number, title: string, max: number, low: number, red: number, ticks: number[]) {
  const cx = x + 85, cy = y + 116, r = 66;
  rc(svg, x, y, 170, 150, 'p4-gauge-bg', 10);
  tx(svg, cx, y + 18, title, 'm-label small', 'middle');
  el('path', { d: arc(cx, cy, r + 4, ang(0, max), ang(low, max)), class: 'p4-zone-low' }, svg);
  el('path', { d: arc(cx, cy, r + 4, ang(red, max), ang(max, max)), class: 'p4-zone-high' }, svg);
  el('path', { d: arc(cx, cy, r, -60, 60), class: 'p4-scale' }, svg);
  for (const t of ticks) {
    const a = ang(t, max);
    el('line', { x1: cx + (r - 6) * Math.sin(rad(a)), y1: cy - (r - 6) * Math.cos(rad(a)), x2: cx + (r + 3) * Math.sin(rad(a)), y2: cy - (r + 3) * Math.cos(rad(a)), class: 'p4-scale' }, svg);
    tx(svg, cx + (r + 14) * Math.sin(rad(a)), cy - (r + 14) * Math.cos(rad(a)) + 4, String(t), 'm-io', 'middle');
  }
  const needle = el('g', {}, svg);
  el('line', { x1: cx, y1: cy, x2: cx, y2: cy - r + 4, class: 'p4-needle' }, needle);
  el('circle', { cx, cy, r: 6, class: 'p4-hub' }, svg);
  const val = tx(svg, cx, cy + 22, '', 'm-label small', 'middle');
  return (v: number, unit: string) => {
    needle.setAttribute('transform', `rotate(${ang(v, max)} ${cx} ${cy})`);
    val.textContent = `${Math.round(v)} ${unit}`;
  };
}

const mix = (a: number[], b: number[], t: number) => a.map((v, i) => Math.round(v + (b[i]! - v) * t));

const view = (): ModelView => {
  let r: {
    gp: (v: number, u: string) => void; gt: (v: number, u: string) => void; limit: SVGCircleElement[]; lamps: SVGCircleElement[];
    liquid: SVGPathElement; blade: SVGEllipseElement; coil: SVGPathElement; v1: SVGGElement; v2: SVGGElement; pipes: SVGPathElement[];
    mled: SVGCircleElement; steam: SVGGElement; warn: SVGGElement;
  };
  return {
    mount(svg, logic) {
      const L = logic as ReakgefLogic;
      rc(svg, 0, 0, 720, 460, 'm-bg');
      const gp = gauge(svg, 20, 16, 'Dampfdruck p', 100, P_LOW, P_HIGH, [0, 25, 50, 75, 100]);
      const gt = gauge(svg, 20, 176, 'Temperatur T', 200, T_LOW, T_HIGH, [0, 50, 100, 150, 200]);
      void P_BURST; void T_RUNAWAY;
      // Grenzwertgeber
      const limit = [lamp(svg, 216, 64, '', '', 'red'), lamp(svg, 216, 108, '', '', 'red'), lamp(svg, 216, 224, '', '', 'red'), lamp(svg, 216, 268, '', '', 'red')];
      for (const [i, [t, io]] of [['p zu hoch', 'S1 · Ex.0'], ['p zu niedrig', 'S2 · Ex.1'], ['T zu hoch', 'S3 · Ex.2'], ['T zu niedrig', 'S4 · Ex.3']].entries()) {
        const y = [64, 108, 224, 268][i]!;
        tx(svg, 232, y - 1, t!, 'm-label'); tx(svg, 232, y + 11, io!, 'm-io');
      }
      // Meldelampen
      const lamps = [lamp(svg, 36, 358, '', '', 'green'), lamp(svg, 36, 392, '', '', 'yellow'), lamp(svg, 36, 426, '', '', 'red')];
      for (const [i, [t, io]] of [['Normalbetrieb', 'P1 · Ax.0'], ['Anfahren', 'P2 · Ax.1'], ['Alarm', 'P3 · Ax.2']].entries()) {
        const y = 358 + i * 34;
        tx(svg, 52, y - 1, t!, 'm-label'); tx(svg, 52, y + 11, io!, 'm-io');
      }
      // Störungstasten
      rc(svg, 410, 12, 214, 66, 'm-panel', 10);
      tx(svg, 422, 28, 'Störung (gedrückt halten)', 'm-label small');
      panelButton(svg, 422, 34, '', 'p↑', 'm-btn-grey', (d) => L.input('pup', d), '', 56);
      panelButton(svg, 490, 34, '', 'T↑', 'm-btn-grey', (d) => L.input('tup', d), '', 56);
      panelButton(svg, 558, 34, '', 'p↓ T↑', 'm-btn-grey', (d) => L.input('ptup', d), '', 56);
      // Rohre
      const pipes = [
        el('path', { d: 'M300 190 H400', class: 'p2-pipe' }, svg), el('path', { d: 'M640 230 H710', class: 'p2-pipe' }, svg),
        el('path', { d: 'M610 148 V92', class: 'p2-pipe' }, svg),
      ];
      // Behälter
      el('path', { d: 'M400 148 H640 V250 A120 110 0 0 1 400 250 Z', class: 'p4-vessel' }, svg);
      const liquid = el('path', { d: 'M412 215 H628 V250 A108 98 0 0 1 412 250 Z', class: 'p4-liquid' }, svg);
      el('path', { d: 'M400 148 H640 V250 A120 110 0 0 1 400 250 Z', class: 'p4-vessel-line' }, svg);
      rc(svg, 396, 130, 248, 18, 'm-steel', 3);
      const coil = el('path', { d: 'M470 384 l10 -16 l10 16 l10 -16 l10 16 l10 -16 l10 16 l10 -16 l10 16 l10 -16 l10 16', class: 'p4-coil' }, svg);
      tx(svg, 520, 404, 'Q · Ax.5', 'm-io', 'middle');
      // Rührwerk
      el('line', { x1: 520, y1: 128, x2: 520, y2: 322, class: 'p4-shaft' }, svg);
      const blade = el('ellipse', { cx: 520, cy: 322, rx: 40, ry: 7, class: 'p4-blade' }, svg);
      el('circle', { cx: 520, cy: 110, r: 17, class: 'm-motor-body' }, svg);
      tx(svg, 520, 115, 'M', 'm-label light', 'middle');
      const mled = el('circle', { cx: 486, cy: 110, r: 5, class: 'm-lamp' }, svg);
      tx(svg, 476, 114, 'M · Ax.6', 'm-io', 'end');
      // Ventile
      const v1 = bow(svg, 350, 190, 'V1', 'Ax.3');
      const v2 = bow(svg, 610, 116, 'V2', 'Ax.4', true);
      const steam = el('g', { class: 'p4-steam' }, svg);
      el('path', { d: 'M606 88 q-8 -12 0 -22 q8 -10 0 -20 M614 88 q8 -12 0 -22 q-8 -10 0 -20', class: 'p4-steam-path' }, steam);
      panelButton(svg, 480, 414, '', 'Behälter erneuern', 'm-btn-grey', (d) => L.input('repair', d), '', 160);
      tx(svg, 300, 176, 'Zulauf', 'm-io'); tx(svg, 656, 220, 'Ablauf', 'm-io');
      const warn = el('g', { class: 'p2-warn', transform: 'translate(330 330)' }, svg);
      el('path', { d: 'M0 -26 L26 20 L-26 20 Z', class: 'p2-warn-tri' }, warn);
      tx(warn, 0, 14, '!', 'p2-warn-text', 'middle');
      r = { gp, gt, limit, lamps, liquid, blade, coil, v1, v2, pipes, mled, steam, warn };
    },
    render(logic, ax) {
      const L = logic as ReakgefLogic;
      r.gp(L.p, 'bar'); r.gt(L.T, '°C');
      const ex = L.ex;
      r.limit.forEach((l, i) => l.classList.toggle('on', ((ex >> i) & 1) === 1));
      r.lamps.forEach((l, i) => l.classList.toggle('on', ((ax >> i) & 1) === 1));
      const c = mix([122, 63, 176], [220, 70, 60], Math.min(1, Math.max(0, (L.T - 20) / 180)));
      r.liquid.setAttribute('style', `fill: rgb(${c.join(',')})`);
      r.blade.setAttribute('rx', String(Math.abs(Math.cos(rad(L.stir))) * 40 + 2));
      r.coil.classList.toggle('on', ((ax >> 5) & 1) === 1 && !L.damage);
      r.v1.classList.toggle('on', ((ax >> 3) & 1) === 1);
      r.v2.classList.toggle('on', ((ax >> 4) & 1) === 1);
      r.pipes[0]!.classList.toggle('on', ((ax >> 3) & 1) === 1);
      r.pipes[1]!.classList.toggle('on', ((ax >> 3) & 1) === 1);
      r.pipes[2]!.classList.toggle('on', ((ax >> 4) & 1) === 1);
      r.steam.classList.toggle('on', ((ax >> 4) & 1) === 1);
      r.mled.classList.toggle('on', ((ax >> 6) & 1) === 1);
      r.warn.classList.toggle('on', L.damage !== '' || (L.status.startsWith('Warnung')));
    },
  };
};

export const reakgef: ExternalModelDef = {
  id: 'ext-reakgef',
  name: 'Reaktionsgefäß',
  group: 'Modellpaket 2',
  desc: 'Beheizter, gerührter Reaktor (Modellvariante A, ohne Drahtbruchsicherheit): Anfahren auf 100 °C, im Normalbetrieb Druck und Temperatur innerhalb der Grenzwerte halten. Überdruck (≥ 100 bar) sprengt den Behälter, Übertemperatur (≥ 200 °C) lässt die Reaktion durchgehen.',
  ax: ['P1 Meldelampe Normalbetrieb', 'P2 Meldelampe Anfahren', 'P3 Alarm (Hupe)', 'V1 Ventil Kühlzulauf', 'V2 Ventil Druckablass', 'Q Heizung', 'M Rührwerk', ''],
  ex: ['S1 Druck p zu hoch (> 75 bar)', 'S2 Druck p zu niedrig (< 25 bar)', 'S3 Temperatur T zu hoch (> 150 °C)', 'S4 Temperatur T zu niedrig (< 100 °C)', '', '', '', ''],
  width: 720,
  height: 460,
  createLogic: () => new ReakgefLogic(),
  createView: view,
};
