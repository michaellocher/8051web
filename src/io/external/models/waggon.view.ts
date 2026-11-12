import { el } from '../../kit.ts';
import type { ExternalModelDef, ModelView } from '../frame.ts';
import { WaggonLogic } from './waggon.logic.ts';
import { panelButton } from './parts.ts';
import { ln, rc, tx } from './p2.parts.ts';
import { sensorBox } from './p3.parts.ts';

const SX = 290, SW = 120, S_TOP = 20, S_BODY = 130, S_BOT = 190; // Silo (Mitte x = SX + SW/2)
const CX = SX + SW / 2;
const WAG_Y = 346, WAG_W = 130, TRAVEL = 330;
let uid = 0;

const wheel = (p: Element, x: number, y: number) => { el('circle', { cx: x, cy: y, r: 11, class: 'p3-wheel-b' }, p); el('circle', { cx: x, cy: y, r: 3, fill: '#fff' }, p); };

const view = (): ModelView => {
  let r: {
    grain: SVGRectElement; wagon: SVGGElement; wfill: SVGRectElement; cell: SVGGElement; blower: SVGGElement; fluid: SVGGElement;
    pipes: SVGPathElement[]; stream: SVGLineElement; sens: SVGRectElement[]; clog: SVGTextElement;
  };
  return {
    mount(svg, logic) {
      const L = logic as WaggonLogic;
      const id = `p3-silo-clip-${++uid}`;
      rc(svg, 0, 0, 720, 460, 'm-bg');
      // Bedienung
      rc(svg, 14, 14, 200, 110, 'm-panel', 10);
      panelButton(svg, 28, 22, 'S1', 'Start', 'm-btn-green', (d) => L.input('s1', d), 'Ex.0');
      panelButton(svg, 28, 70, 'S8', 'Silo füllen', 'm-btn-yellow', (d) => L.input('s8', d), 'Ex.7');
      panelButton(svg, 20, 410, 'S6', 'Leerwaggon ein', 'm-btn-grey', (d) => L.input('s6', d), 'Ex.5');
      panelButton(svg, 220, 410, 'S7', 'Vollwaggon aus', 'm-btn-grey', (d) => L.input('s7', d), 'Ex.6');
      // Rohre (hinter dem Silo)
      const fluidPipe = el('path', { d: `M510 60 H${SX + SW + 40} V150 L${SX + SW - 10} 160`, class: 'p3-pipe' }, svg);
      const airPipe = el('path', { d: `M500 280 H${CX}`, class: 'p3-pipe' }, svg);
      const matPipe = el('path', { d: `M${CX} 232 V318`, class: 'p3-pipe dust' }, svg);
      // Silo
      const shape = `M${SX} ${S_TOP} H${SX + SW} V${S_BODY} L${CX + 18} ${S_BOT} H${CX - 18} L${SX} ${S_BODY} Z`;
      el('clipPath', { id }, svg).append(el('path', { d: shape }));
      el('path', { d: shape, fill: '#fff' }, svg);
      const g = el('g', { 'clip-path': `url(#${id})` }, svg);
      const grain = rc(g, SX, S_BOT, SW, 0, 'p3-grain-lt');
      el('path', { d: shape, class: 'p3-wall' }, svg);
      tx(svg, CX, S_TOP - 6, 'Silo', 'm-label', 'middle');
      // Sensoren am Silo
      ln(svg, SX - 20, 38, SX + 2, 38, 'p3-tick'); ln(svg, SX - 20, 172, SX + 20, 172, 'p3-tick');
      const sens = [
        sensorBox(svg, SX - 28, 172, 'S2', 'Ex.1', 'left'),
        sensorBox(svg, SX - 28, 38, 'S3', 'Ex.2', 'left'),
      ];
      // Zellenradschleuse P3
      const cell = el('g', { transform: `translate(${CX} 212)` }, svg);
      el('circle', { cx: 0, cy: 0, r: 22, class: 'p3-white' }, cell);
      for (let i = 0; i < 8; i++) ln(cell, 0, 0, 0, -20, 'p3-roller-x');
      for (let i = 1; i < 8; i++) cell.lastElementChild?.parentElement?.children[i + 1]?.setAttribute('transform', `rotate(${i * 45})`);
      tx(svg, CX + 30, 208, 'P3', 'm-label small');
      tx(svg, CX + 30, 220, 'Ax.2', 'm-io');
      // Gebläse P2 und Fluidisierung P1
      const blower = el('g', { transform: 'translate(525 280)' }, svg);
      el('circle', { cx: 0, cy: 0, r: 26, class: 'p3-red' }, blower);
      el('path', { d: 'M-14 -6 L14 0 L-14 6 Z', fill: '#fff' }, blower);
      tx(svg, 560, 276, 'P2', 'm-label small'); tx(svg, 560, 288, 'Ax.1', 'm-io');
      const fluid = el('g', { transform: 'translate(535 60)' }, svg);
      el('circle', { cx: 0, cy: 0, r: 26, class: 'p3-red' }, fluid);
      el('path', { d: 'M-14 -6 L14 0 L-14 6 Z', fill: '#fff' }, fluid);
      tx(svg, 572, 56, 'P1', 'm-label small'); tx(svg, 572, 68, 'Ax.0', 'm-io');
      tx(svg, 535, 100, 'Fluidisierung', 'm-io', 'middle');
      tx(svg, 525, 322, 'Fördergebläse', 'm-io', 'middle');
      const stream = el('line', { x1: CX, y1: 318, x2: CX, y2: WAG_Y + 10, class: 'p3-stream grain' }, svg);
      // Gleis und Waggon
      rc(svg, 0, 394, 720, 8, 'p3-metal-dark');
      for (let x = 10; x < 720; x += 40) rc(svg, x, 402, 16, 6, 'p3-metal-dark');
      const wagon = el('g', { transform: `translate(${CX} 0)` }, svg);
      rc(wagon, -WAG_W / 2, WAG_Y, WAG_W, 44, 'p3-wagon-body', 4);
      el('clipPath', { id: `${id}-w` }, svg).append(el('rect', { x: -WAG_W / 2 + 4, y: WAG_Y + 4, width: WAG_W - 8, height: 36 }));
      const wg = el('g', { 'clip-path': `url(#${id}-w)` }, wagon);
      const wfill = rc(wg, -WAG_W / 2 + 4, WAG_Y + 40, WAG_W - 8, 0, 'p3-grain-lt');
      wheel(wagon, -WAG_W / 2 + 22, 390); wheel(wagon, WAG_W / 2 - 22, 390);
      sens.push(sensorBox(svg, 190, 318, 'S5 Position', 'Ex.4', 'left'));
      sens.push(sensorBox(svg, 420, 318, 'S4 voll', 'Ex.3'));
      const clog = tx(svg, 14, 150, '', 'p3-msg');
      r = { grain, wagon, wfill, cell, blower, fluid, pipes: [fluidPipe, airPipe, matPipe], stream, sens, clog };
    },
    render(logic) {
      const L = logic as WaggonLogic;
      const k = S_BOT - S_TOP;
      r.grain.setAttribute('y', String(S_BOT - L.silo * k)); r.grain.setAttribute('height', String(L.silo * k));
      r.wagon.setAttribute('transform', `translate(${CX + L.wx * TRAVEL} 0)`);
      r.wfill.setAttribute('y', String(WAG_Y + 40 - L.fill * 36)); r.wfill.setAttribute('height', String(L.fill * 36));
      r.cell.setAttribute('transform', `translate(${CX} 212) rotate(${L.p3.angle / 2})`);
      r.blower.firstElementChild?.setAttribute('class', L.p2.running ? 'm-motor' : 'p3-red');
      r.fluid.firstElementChild?.setAttribute('class', L.p1.running ? 'm-motor' : 'p3-red');
      r.pipes[0]!.classList.toggle('on', L.p1.running);
      r.pipes[1]!.classList.toggle('on', L.p2.running);
      r.pipes[2]!.classList.toggle('on', L.flowing);
      r.stream.style.display = L.flowing ? '' : 'none';
      const ex = L.ex;
      [1, 2, 4, 3].forEach((b, i) => r.sens[i]!.classList.toggle('on', ((ex >> b) & 1) === 1));
      r.clog.textContent = L.clogged ? 'Leitung verstopft!' : '';
    },
  };
};

export const waggon: ExternalModelDef = {
  id: 'ext-waggon',
  name: 'Waggonbeladung',
  group: 'Modellpaket 2',
  desc: 'Ein Silo belädt über Zellenradschleuse P3 und Fördergebläse P2 einen Waggon (Fluidisierung P1 gegen Brückenbildung). Reihenfolge einhalten, bei vollem Waggon stoppen. Waggons mit S6/S7, Silo mit S8 von Hand. Modellvariante A: Schließer.',
  ax: ['P1 Fluidisierung Silokonus', 'P2 Fördergebläse', 'P3 Zellenradschleuse', '', '', '', '', ''],
  ex: ['S1 Taster Start', 'S2 Silo nicht leer', 'S3 Silo voll', 'S4 Waggon voll', 'S5 Waggon in Position', 'S6 Taster Leerwaggon einfahren', 'S7 Taster Vollwaggon ausfahren', 'S8 Taster Silo füllen'],
  width: 720,
  height: 460,
  createLogic: () => new WaggonLogic(),
  createView: view,
};
