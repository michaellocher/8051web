import { el } from '../../kit.ts';
import type { ExternalModelDef, ModelView } from '../frame.ts';
import { Bohr2Logic } from './bohr2.logic.ts';
import { lamp, panelButton, valveSymbol } from './parts.ts';
import { rc, tx } from './p2.parts.ts';

const view = (): ModelView => {
  let r: {
    rod: SVGRectElement; carriage: SVGGElement; piece: SVGRectElement; hole: SVGRectElement; drill: SVGGElement; chuck: SVGGElement;
    bit: SVGLineElement; led: SVGCircleElement; lamps: SVGCircleElement[]; valves: SVGGElement[]; count: SVGTextElement;
  };
  return {
    mount(svg, logic) {
      const L = logic as Bohr2Logic;
      rc(svg, 0, 0, 720, 460, 'm-bg');
      rc(svg, 20, 20, 200, 130, 'm-panel', 10);
      panelButton(svg, 36, 34, 'S1', 'START', 'm-btn-green', (d) => L.input('start', d), 'Ex.0');
      panelButton(svg, 36, 88, 'S2', 'RESET', 'm-btn-blue', (d) => L.input('reset', d), 'Ex.1');
      // Grundplatte und Säule
      rc(svg, 30, 410, 660, 40, 'p4-base', 4);
      rc(svg, 640, 40, 34, 370, 'p4-base');
      tx(svg, 657, 70, 'Z2', 'm-label light', 'middle');
      rc(svg, 470, 380, 110, 30, 'p2-die');
      // Zylinder Z1 mit Schlitten
      rc(svg, 40, 376, 160, 26, 'm-cyl', 4);
      tx(svg, 120, 394, 'Z1', 'm-label light', 'middle');
      const rod = rc(svg, 200, 385, 30, 8, 'm-rod');
      const carriage = el('g', { transform: 'translate(230 0)' }, svg);
      rc(carriage, 0, 376, 120, 20, 'p4-slide', 3);
      const piece = rc(carriage, 15, 340, 90, 36, 'm-piece', 2);
      const hole = rc(carriage, 55, 340, 10, 0, 'm-hole');
      // Bohrmaschine
      const drill = el('g', {}, svg);
      rc(drill, 540, 130, 100, 16, 'p4-base');
      rc(drill, 490, 90, 60, 70, 'm-motor', 10);
      tx(drill, 520, 130, 'M1', 'm-label light', 'middle');
      tx(drill, 484, 118, 'M1 · Ax.4', 'm-io', 'end');
      const led = el('circle', { cx: 540, cy: 100, r: 5, class: 'm-lamp' }, drill);
      const chuck = el('g', {}, drill);
      rc(chuck, 512, 160, 16, 14, 'm-steel');
      rc(chuck, 515, 164, 4, 10, 'p4-mark');
      const bit = el('line', { x1: 520, y1: 174, x2: 520, y2: 230, class: 'm-bit' }, drill);
      // Sensoren
      const lamps = [
        lamp(svg, 110, 340, 'GIS1', 'Ex.2'), lamp(svg, 612, 340, 'GIS2', 'Ex.3'),
        lamp(svg, 700, 100, 'GIS3', 'Ex.4'), lamp(svg, 700, 260, 'GIS4', 'Ex.5'),
      ];
      // Ventile
      rc(svg, 20, 170, 270, 102, 'm-panel', 10);
      const valves = [
        valveSymbol(svg, 36, 186, 'Z1 vor', 'Ax.0'), valveSymbol(svg, 36, 226, 'Z1 zurück', 'Ax.1'),
        valveSymbol(svg, 160, 186, 'Z2 ab', 'Ax.2'), valveSymbol(svg, 160, 226, 'Z2 auf', 'Ax.3'),
      ];
      panelButton(svg, 260, 414, '', 'Werkstück einlegen', 'm-btn-grey', (d) => L.input('piece', d), '', 150);
      const count = tx(svg, 690, 30, '', 'm-label', 'end');
      r = { rod, carriage, piece, hole, drill, chuck, bit, led, lamps, valves, count };
    },
    render(logic, ax) {
      const L = logic as Bohr2Logic;
      const cx = 230 + 230 * L.z1.pos;
      r.carriage.setAttribute('transform', `translate(${cx} 0)`);
      r.rod.setAttribute('width', String(cx - 200));
      r.piece.style.display = L.piece === 'none' ? 'none' : '';
      r.hole.setAttribute('height', String(L.piece === 'drilled' ? 36 : L.depth * 36));
      const dy = L.z2.pos * 140;
      r.drill.setAttribute('transform', `translate(0 ${dy})`);
      r.chuck.setAttribute('transform', `rotate(${L.motor.angle} 520 167)`);
      r.bit.classList.toggle('broken', L.bitBroken);
      r.bit.setAttribute('y2', String(L.bitBroken ? 190 : 230));
      r.led.classList.toggle('on', L.motor.running);
      const ex = L.ex;
      [2, 3, 4, 5].forEach((b, i) => r.lamps[i]!.classList.toggle('on', ((ex >> b) & 1) === 1));
      r.valves.forEach((v, i) => v.classList.toggle('on', ((ax >> i) & 1) === 1));
      r.count.textContent = `Gebohrt: ${L.drilledCount}`;
    },
  };
};

export const bohr2: ExternalModelDef = {
  id: 'ext-bohr2',
  name: 'Einfache Bohrvorrichtung',
  group: 'Modellpaket 2',
  desc: 'Zylinder Z1 fährt das Werkstück unter den Bohrer, Z2 senkt die laufende Bohrmaschine ab. Fährt der Bohrer ohne Drehung ein oder der Schlitten gegen den Bohrer, bricht er (RESET wechselt ihn).',
  ax: ['Z1 vor (Werkstück unter den Bohrer)', 'Z1 zurück', 'Z2 ab (Bohrer senken)', 'Z2 auf (Bohrer heben)', 'M1 Bohrmotor', '', '', ''],
  ex: ['S1 Taster START', 'S2 Taster RESET', 'GIS1 Z1 hinten', 'GIS2 Z1 vorn', 'GIS3 Z2 oben', 'GIS4 Z2 unten', '', ''],
  width: 720,
  height: 460,
  createLogic: () => new Bohr2Logic(),
  createView: view,
};
