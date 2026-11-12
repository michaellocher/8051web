import { el } from '../../kit.ts';
import type { ExternalModelDef, ModelView } from '../frame.ts';
import { FarbeLogic } from './farbe.logic.ts';
import { lamp, panelButton, panelSwitch } from './parts.ts';
import { bow, ln, rc, tx } from './p2.parts.ts';
import { faultButton } from './p1.parts.ts';
import { sensorBox } from './p3.parts.ts';

const TL = 250, TR = 480, TT = 120, TB = 390, CX = 365;
const TH = TB - TT;
let uid = 0;

const view = (): ModelView => {
  let r: {
    paint: SVGRectElement; res: SVGRectElement; pump: SVGGElement; pumpBody: SVGCircleElement; motor: SVGCircleElement; blade: SVGRectElement;
    pipe: SVGPathElement; outPipe: SVGPathElement; valve: SVGGElement; f: ReturnType<typeof faultButton>[]; s: SVGRectElement[];
    h: SVGCircleElement[]; stream: SVGLineElement; resStream: SVGLineElement;
  };
  return {
    mount(svg, logic) {
      const L = logic as FarbeLogic;
      const id = `p3-farbe-clip-${++uid}`;
      rc(svg, 0, 0, 720, 460, 'm-bg');
      // Bedienfeld
      rc(svg, 470, 14, 246, 112, 'm-panel', 10);
      panelButton(svg, 480, 20, 'S1', 'EIN', 'm-btn-green', (d) => L.input('s1', d), 'Ex.0');
      panelButton(svg, 598, 20, 'S2', 'AUS', 'm-btn-red', (d) => L.input('s2', d), 'Ex.1');
      panelSwitch(svg, 480, 72, 'S5', 'MANU', (on) => L.input('s5', on), 'Ex.6');
      const h = [lamp(svg, 630, 96, 'H1 Störung', 'Ax.3', 'red'), lamp(svg, 688, 96, 'H2 Auto', 'Ax.4', 'green')];
      // Vorratsbehälter links und Pumpe
      const res = rc(svg, 20, 360, 120, 50, 'p3-paint');
      el('path', { d: 'M20 340 V410 H140 V340', class: 'p3-wall' }, svg);
      tx(svg, 80, 432, 'Vorrat', 'm-label small', 'middle');
      const pipe = el('path', { d: `M80 388 V250 M80 214 V100 H${TL + 40} V${TT + 20}`, class: 'p3-pipe' }, svg);
      const pump = el('g', { transform: 'translate(80 232)' }, svg);
      const pumpBody = el('circle', { cx: 0, cy: 0, r: 26, class: 'm-motor-body' }, pump);
      const rot = el('g', {}, pump);
      el('path', { d: 'M-12 -6 L14 0 L-12 6 Z', class: 'm-motor-mark' }, rot);
      tx(svg, 112, 228, 'K1', 'm-label small'); tx(svg, 112, 240, 'Ax.0', 'm-io');
      // Rührbehälter
      el('clipPath', { id }, svg).append(el('rect', { x: TL, y: TT, width: TR - TL, height: TH }));
      rc(svg, TL, TT, TR - TL, TH, 'p3-glass');
      const pg = el('g', { 'clip-path': `url(#${id})` }, svg);
      const paint = rc(pg, TL, TB, TR - TL, 0, 'p3-paint');
      const resStream = el('line', { x1: TL + 40, y1: TT + 20, x2: TL + 40, y2: TB, class: 'p3-stream paint' }, svg);
      el('path', { d: `M${TL} ${TT - 14} V${TB} H${TR} V${TT - 14}`, class: 'p3-wall' }, svg);
      // Rührwerk
      el('line', { x1: CX, y1: 90, x2: CX, y2: 350, stroke: '#6b737b', 'stroke-width': 9 }, svg);
      const blade = rc(svg, CX - 34, 344, 68, 14, 'p3-stirrer', 3);
      const motor = el('circle', { cx: CX, cy: 66, r: 22, class: 'm-motor-body' }, svg);
      tx(svg, CX, 72, 'M', 'm-label light', 'middle');
      tx(svg, CX + 28, 62, 'K2', 'm-label small'); tx(svg, CX + 28, 74, 'Ax.1', 'm-io');
      // Sensoren
      const s = [
        sensorBox(svg, TR + 30, TT + (1 - 0.9) * TH + 8, 'S3 max', 'Ex.2'),
        sensorBox(svg, TR + 30, TB - 6, 'S4 min', 'Ex.3'),
      ];
      ln(svg, TR, TT + (1 - 0.9) * TH + 8, TR + 22, TT + (1 - 0.9) * TH + 8, 'p3-tick'); ln(svg, TR, TB - 6, TR + 22, TB - 6, 'p3-tick');
      // Ablass
      const outPipe = el('path', { d: `M${CX} ${TB} V455`, class: 'p3-pipe' }, svg);
      const valve = bow(svg, CX, 420, 'V1', 'Ax.2', true);
      const stream = el('line', { x1: CX, y1: TB, x2: CX, y2: 455, class: 'p3-stream paint' }, svg);
      // Störungen
      const f = [
        faultButton(svg, 20, 190, 'Motorschutz F1 (Pumpe) auslösen/zurücksetzen', () => L.input('f1', !L.f1)),
        faultButton(svg, 284, 52, 'Motorschutz F2 (Rührwerk) auslösen/zurücksetzen', () => L.input('f2', !L.f2)),
      ];
      tx(svg, 36, 184, 'F1 Ex.4', 'm-label small', 'middle');
      tx(svg, 300, 46, 'F2 Ex.5', 'm-label small', 'middle');
      r = { paint, res, pump: rot, pumpBody, motor, blade, pipe, outPipe, valve, f, s, h, stream, resStream };
    },
    render(logic) {
      const L = logic as FarbeLogic;
      r.paint.setAttribute('y', String(TB - L.level * TH)); r.paint.setAttribute('height', String(L.level * TH));
      // Mischfarbe: ungemischt → orange, gemischt → sattes Rot
      r.paint.style.fill = L.mix > 0.9 ? '#c8452d' : '';
      r.pump.setAttribute('transform', `rotate(${L.pump.angle})`);
      r.pumpBody.style.fill = L.pump.running ? '#2a4fd6' : '';
      r.motor.style.fill = L.stir.running ? '#2a4fd6' : '';
      r.blade.setAttribute('transform', `translate(${CX} 0) scale(${Math.max(0.15, Math.abs(Math.cos((L.stir.angle * Math.PI) / 180)))} 1) translate(${-CX} 0)`);
      r.pipe.classList.toggle('on', L.pump.running);
      r.resStream.style.display = L.pump.running && L.level < 1 ? '' : 'none';
      r.resStream.setAttribute('y2', String(TB - L.level * TH));
      r.valve.classList.toggle('on', L.v1);
      r.stream.style.display = L.v1 && L.level > 0 ? '' : 'none';
      r.outPipe.classList.toggle('on', L.v1 && L.level > 0);
      r.f[0]!.set(L.f1); r.f[1]!.set(L.f2);
      const ex = L.ex;
      r.s[0]!.classList.toggle('on', ((ex >> 2) & 1) === 1);
      r.s[1]!.classList.toggle('on', ((ex >> 3) & 1) === 1);
      r.h[0]!.classList.toggle('on', L.h1);
      r.h[1]!.classList.toggle('on', L.h2);
    },
  };
};

export const farbe: ExternalModelDef = {
  id: 'ext-farbe',
  name: 'Farbrührwerk',
  group: 'Modellpaket 2',
  desc: 'Eine Pumpe füllt Farbe in den Rührbehälter, das Rührwerk mischt sie (mindestens 4 s), dann wird über V1 abgelassen. Automatik und Handbetrieb (MANU), Motorschutz F1/F2. Modellvariante A: Schließer.',
  ax: ['K1 Pumpe', 'K2 Rührwerk', 'V1 Ablassventil', 'H1 Meldeleuchte Störung', 'H2 Meldeleuchte Automatik', '', '', ''],
  ex: ['S1 Taster EIN', 'S2 Taster AUS', 'S3 Füllstand max.', 'S4 Füllstand min.', 'F1 Motorschutz Pumpe', 'F2 Motorschutz Rührwerk', 'S5 Schalter MANU', ''],
  width: 720,
  height: 460,
  createLogic: () => new FarbeLogic(),
  createView: view,
};
