import { el } from '../../kit.ts';
import type { ExternalModelDef, ModelView } from '../frame.ts';
import { AbsaugLogic } from './absaug.logic.ts';
import { lamp, panelButton, panelSwitch } from './parts.ts';
import { ln, rc, tx } from './p2.parts.ts';
import { faultButton, fan } from './p1.parts.ts';

let uid = 0;

const view = (): ModelView => {
  let r: {
    fan: ReturnType<typeof fan>; valve: SVGGElement; duct: SVGPathElement; sep: SVGRectElement; bin: SVGRectElement;
    lamps: SVGCircleElement[]; q: ReturnType<typeof faultButton>[]; cloud: SVGGElement; mlamp: SVGCircleElement[]; arrows: SVGGElement;
  };
  return {
    mount(svg, logic) {
      const L = logic as AbsaugLogic;
      const id = `p3-cyc-clip-${++uid}`;
      rc(svg, 0, 0, 720, 460, 'm-bg');
      // Bedienung
      rc(svg, 14, 14, 190, 56, 'm-panel', 10);
      panelSwitch(svg, 26, 22, 'S0', 'Maschine EIN', (on) => L.input('machine', on), 'Ex.0');
      panelButton(svg, 225, 16, 'S1', 'EIN', 'm-btn-green', (d) => L.input('s1', d), 'Ex.1');
      panelButton(svg, 335, 16, 'S2', 'AUS', 'm-btn-red', (d) => L.input('s2', d), 'Ex.2');
      panelButton(svg, 445, 16, 'S3', 'Check', 'm-btn-blue', (d) => L.input('check', d), 'Ex.3');
      const lamps = [lamp(svg, 250, 100, 'H1 M1', 'Ax.2'), lamp(svg, 350, 100, 'H2 M2', 'Ax.3'), lamp(svg, 450, 100, 'H3 Störung', 'Ax.4', 'red')];
      // Rohr und Abscheider
      const duct = el('path', { d: 'M125 318 V175 H548', class: 'p3-pipe dust' }, svg);
      const cyc = 'M560 125 H690 V195 L640 248 H610 L560 195 Z';
      el('clipPath', { id }, svg).append(el('path', { d: cyc }));
      el('path', { d: cyc, class: 'p3-glass' }, svg);
      const g = el('g', { 'clip-path': `url(#${id})` }, svg);
      const sep = rc(g, 560, 248, 130, 0, 'p3-grain');
      el('path', { d: cyc, class: 'p3-wall' }, svg);
      tx(svg, 625, 150, 'Abscheider', 'm-label small', 'middle');
      // Ventilator M1
      const fn = fan(svg, 340, 175, 27);
      tx(svg, 340, 220, 'M1  Ax.0', 'm-label small', 'middle');
      // Zellenradschleuse M2
      const valve = el('g', { transform: 'translate(625 264)' }, svg);
      el('circle', { cx: 0, cy: 0, r: 17, class: 'p3-metal' }, valve);
      for (let i = 0; i < 6; i++) el('line', { x1: 0, y1: 0, x2: 0, y2: -15, class: 'p3-roller-x', transform: `rotate(${i * 60})` }, valve);
      tx(svg, 603, 261, 'M2', 'm-label small', 'end');
      tx(svg, 603, 273, 'Ax.1', 'm-io', 'end');
      ln(svg, 625, 281, 625, 330, 'p3-tick');
      // Behälter
      rc(svg, 575, 330, 100, 90, 'p3-glass');
      const bin = rc(svg, 577, 418, 96, 0, 'p3-grain');
      tx(svg, 625, 440, 'Sammelbehälter', 'm-label small', 'middle');
      // Maschine mit Haube
      rc(svg, 40, 392, 170, 14, 'p3-metal-dark');
      rc(svg, 50, 406, 12, 34, 'p3-metal-dark'); rc(svg, 188, 406, 12, 34, 'p3-metal-dark');
      rc(svg, 70, 364, 110, 28, 'p3-metal', 3);
      el('path', { d: 'M78 364 L172 364 L125 322 Z', class: 'p3-metal-dark' }, svg);
      const arrows = el('g', {}, svg);
      for (const x of [100, 125, 150]) { ln(arrows, x, 360, x, 340, 'p3-tick'); el('path', { d: `M${x - 4} 346 L${x} 338 L${x + 4} 346`, fill: 'none', stroke: '#333', 'stroke-width': 1.5 }, arrows); }
      const cloud = el('g', { opacity: 0 }, svg);
      for (const [x, y, rx] of [[70, 350, 26], [185, 345, 30], [125, 296, 34], [40, 320, 20]] as const) el('ellipse', { cx: x, cy: y, rx, ry: rx * 0.6, class: 'p3-dust' }, cloud);
      const mlamp = [el('circle', { cx: 196, cy: 378, r: 5, class: 'm-lamp' }, svg), el('circle', { cx: 196, cy: 392, r: 5, class: 'm-lamp red' }, svg)];
      tx(svg, 125, 456, 'Werkzeugmaschine', 'm-label small', 'middle');
      // Störungen
      const q = [
        faultButton(svg, 400, 190, 'Motorschutz Q1 (M1) auslösen/zurücksetzen', () => L.input('q1', !L.q1)),
        faultButton(svg, 658, 258, 'Motorschutz Q2 (M2) auslösen/zurücksetzen', () => L.input('q2', !L.q2)),
      ];
      tx(svg, 436, 208, 'Q1 Ex.4', 'm-label small');
      tx(svg, 674, 304, 'Q2 Ex.5', 'm-label small', 'middle');
      r = { fan: fn, valve, duct, sep, bin, lamps, q, cloud, mlamp, arrows };
    },
    render(logic) {
      const L = logic as AbsaugLogic;
      r.fan.update(L.m1.angle, L.m1.running);
      r.valve.setAttribute('transform', `translate(625 264) rotate(${L.m2.angle / 2})`);
      const dusty = L.machine && L.capture > 0.2;
      r.duct.classList.toggle('on', dusty);
      r.arrows.style.opacity = L.machine ? String(0.3 + 0.7 * L.capture) : '0.2';
      r.sep.setAttribute('y', String(248 - L.sep * 123)); r.sep.setAttribute('height', String(L.sep * 123));
      r.bin.setAttribute('y', String(418 - L.bin * 86)); r.bin.setAttribute('height', String(L.bin * 86));
      r.cloud.setAttribute('opacity', L.leaking ? '1' : '0');
      r.lamps.forEach((l, i) => l.classList.toggle('on', L.lamps[i]!));
      r.q[0]!.set(L.q1); r.q[1]!.set(L.q2);
      r.mlamp[0]!.classList.toggle('on', L.machine);
      r.mlamp[1]!.classList.toggle('on', !L.machine);
    },
  };
};

export const absaug: ExternalModelDef = {
  id: 'ext-absaug',
  name: 'Absauganlage',
  group: 'Modellpaket 2',
  desc: 'Eine Werkzeugmaschine (S0) erzeugt Staub. Ventilator M1 saugt ihn in einen Abscheider, die Zellenradschleuse M2 leert ihn. Anlauf-/Nachlaufzeiten beachten, Motorschutz Q1/Q2 überwachen. Modellvariante A: Schließer.',
  ax: ['M1 Ventilator', 'M2 Zellenradschleuse', 'H1 Meldeleuchte M1', 'H2 Meldeleuchte M2', 'H3 Meldeleuchte Störung', '', '', ''],
  ex: ['S0 Schalter Maschine EIN', 'S1 Taster EIN', 'S2 Taster AUS', 'S3 Taster Check', 'Q1 Motorschutz M1', 'Q2 Motorschutz M2', '', ''],
  width: 720,
  height: 460,
  createLogic: () => new AbsaugLogic(),
  createView: view,
};
