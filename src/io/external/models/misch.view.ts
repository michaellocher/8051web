import { el } from '../../kit.ts';
import type { ExternalModelDef, ModelView } from '../frame.ts';
import { MischLogic } from './misch.logic.ts';
import { lamp, panelButton, panelSwitch } from './parts.ts';
import { rect, txt } from './p1.parts.ts';

const SILO_TOP = 150, SILO_H = 130;
const siloPath = (x: number) => `M${x} ${SILO_TOP} H${x + 140} V${SILO_TOP + SILO_H - 20} L${x + 82} ${SILO_TOP + SILO_H + 40} H${x + 58} L${x} ${SILO_TOP + SILO_H - 20} Z`;

const view = (): ModelView => {
  let siloLiquid: SVGRectElement[];
  let mixFill: SVGRectElement;
  let streams: SVGRectElement[];
  let valves: SVGGElement[];
  let lamps: SVGCircleElement[];
  return {
    mount(svg, logic) {
      const L = logic as MischLogic;
      rect(svg, 0, 0, 720, 480, 'm-bg');
      const defs = el('defs', {}, svg);
      siloLiquid = []; valves = []; streams = [];
      [0, 1].forEach((i) => {
        const x = 50 + i * 190;
        const id = `p1-misch-clip${i}`;
        el('path', { d: siloPath(x) }, el('clipPath', { id }, defs));
        const col = i === 0 ? '#d93636' : '#2a4fd6';
        siloLiquid.push(el('rect', { x, y: SILO_TOP, width: 140, height: SILO_H + 50, fill: col, 'clip-path': `url(#${id})` }, svg));
        el('path', { d: siloPath(x), class: 'p1-outline' }, svg);
        txt(svg, x + 70, SILO_TOP - 12, `Silo ${'AB'[i]}`, 'm-label', 'middle');
        streams.push(rect(svg, x + 66, SILO_TOP + SILO_H + 40, 8, 90, 'p1-stream'));
        const v = el('g', { class: 'm-valve', transform: `translate(${x + 59} ${SILO_TOP + SILO_H + 62})` }, svg);
        rect(v, 0, 0, 22, 22, 'm-valve-coil');
        el('path', { d: 'M4 18 L18 4', class: 'm-valve-line' }, v);
        txt(v, 28, 10, `Y${i + 1}`, 'm-label small'); txt(v, 28, 22, `Ax.${2 + i}`, 'm-io');
        valves.push(v);
      });
      lamps = [lamp(svg, 120, 82, 'H1', 'Ax.0', 'red'), lamp(svg, 310, 82, 'H2', 'Ax.1', 'red')];
      txt(svg, 120, 48, 'Silo A leer', 'm-label small', 'middle'); txt(svg, 310, 48, 'Silo B leer', 'm-label small', 'middle');
      // Mischbehälter
      el('clipPath', { id: 'p1-misch-clipm' }, defs).append(el('rect', { x: 52, y: 350, width: 336, height: 92 }));
      mixFill = el('rect', { x: 52, y: 442, width: 336, height: 0, fill: '#888', 'clip-path': 'url(#p1-misch-clipm)' }, svg);
      el('path', { d: 'M50 330 V444 H390 V330', class: 'p1-outline' }, svg);
      [[50, 'B3 · Ex.4'], [92, 'B4 · Ex.5']].forEach(([off, t], k) => {
        const y = 442 - (k === 0 ? 48.4 : 92);
        el('line', { x1: 390, y1: y, x2: 408, y2: y, stroke: '#333', 'stroke-width': 2 }, svg);
        txt(svg, 412, y + 4, String(t), 'm-io'); void off;
      });
      txt(svg, 220, 466, 'Mischbehälter', 'm-label small', 'middle');
      // Bedienfeld
      rect(svg, 440, 24, 260, 190, 'm-panel', 14);
      txt(svg, 570, 48, 'Bedienung', 'm-label', 'middle');
      panelButton(svg, 456, 66, 'S1', 'START', 'm-btn-green', (d) => L.input('start', d), 'Ex.0');
      panelSwitch(svg, 456, 122, 'S2', 'B zuerst', (on) => L.input('sel', on), 'Ex.1');
      txt(svg, 456, 184, 'aus: A zuerst · ein: B zuerst', 'm-io');
      panelButton(svg, 460, 236, '', 'Behälter entleeren', 'm-btn-grey', (d) => L.input('drain', d), '', 170);
      panelButton(svg, 460, 286, '', 'Silos auffüllen', 'm-btn-grey', (d) => L.input('refill', d), '', 170);
      txt(svg, 520, 356, 'Sensoren', 'm-label small');
      txt(svg, 520, 374, 'B1 Silo A leer · Ex.2', 'm-io'); txt(svg, 520, 388, 'B2 Silo B leer · Ex.3', 'm-io');
    },
    render(logic, ax) {
      const L = logic as MischLogic;
      L.silo.forEach((s, i) => {
        const x = 0, top = SILO_TOP + (SILO_H + 50) * (1 - s);
        siloLiquid[i]!.setAttribute('y', String(top)); siloLiquid[i]!.setAttribute('height', String(SILO_H + 50 - (top - SILO_TOP)));
        void x;
      });
      const total = L.total;
      const a = total > 0 ? L.mix[0]! / total : 0.5;
      mixFill.setAttribute('height', String(total * 96.8));
      mixFill.setAttribute('y', String(442 - total * 96.8));
      mixFill.style.fill = `rgb(${Math.round(211 * a + 42 * (1 - a))} ${Math.round(54 * a + 79 * (1 - a))} ${Math.round(54 * a + 214 * (1 - a))})`;
      [0, 1].forEach((i) => {
        const open = ((ax >> (2 + i)) & 1) === 1 && L.silo[i]! > 0;
        valves[i]!.classList.toggle('on', ((ax >> (2 + i)) & 1) === 1);
        streams[i]!.style.display = open ? '' : 'none';
        streams[i]!.style.fill = i === 0 ? '#d93636' : '#2a4fd6';
      });
      lamps.forEach((l, i) => l.classList.toggle('on', ((ax >> i) & 1) === 1));
    },
  };
};

export const misch: ExternalModelDef = {
  id: 'ext-misch',
  name: 'Mischanlage',
  group: 'Modellpaket 1',
  desc: 'Zwei Silos (A rot, B blau) dosieren über die Ventile Y1/Y2 in einen Mischbehälter. Nach START erst die gewählte Komponente bis halb voll, dann die andere bis voll.',
  ax: ['H1 Meldelampe Silo A leer', 'H2 Meldelampe Silo B leer', 'Y1 Ventil Silo A', 'Y2 Ventil Silo B', '', '', '', ''],
  ex: ['S1 Taster START', 'S2 Schalter: 0 = A zuerst, 1 = B zuerst', 'B1 Silo A leer', 'B2 Silo B leer', 'B3 Behälter mind. halb voll', 'B4 Behälter voll', '', ''],
  width: 720,
  height: 480,
  createLogic: () => new MischLogic(),
  createView: view,
};
