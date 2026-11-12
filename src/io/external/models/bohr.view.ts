import { el } from '../../kit.ts';
import type { ExternalModelDef, ModelView } from '../frame.ts';
import { BohrLogic } from './bohr.logic.ts';
import { lamp, panelButton, valveSymbol } from './parts.ts';

const view = (): ModelView => {
  let refs: {
    clampRod: SVGRectElement; jaw: SVGRectElement; carriage: SVGGElement; bit: SVGLineElement; chuck: SVGGElement;
    piece: SVGRectElement; hole: SVGRectElement; lamps: SVGCircleElement[]; valves: SVGGElement[]; motorLed: SVGCircleElement;
  };
  return {
    mount(svg, logic) {
      const L = logic as BohrLogic;
      el('rect', { x: 0, y: 0, width: 720, height: 460, class: 'm-bg' }, svg);
      // Bedienfeld
      el('rect', { x: 20, y: 20, width: 190, height: 120, rx: 10, class: 'm-panel' }, svg);
      panelButton(svg, 36, 36, 'S1', 'START', 'm-btn-green', (d) => L.input('start', d), 'Ex.0');
      panelButton(svg, 36, 86, 'S2', 'RESET', 'm-btn-blue', (d) => L.input('reset', d), 'Ex.1');
      panelButton(svg, 230, 400, '', 'Werkstück einlegen', 'm-btn-grey', (d) => L.input('piece', d), '', 150);
      // Maschinentisch und Ständer
      el('rect', { x: 180, y: 330, width: 500, height: 26, class: 'm-steel' }, svg);
      el('rect', { x: 560, y: 60, width: 34, height: 270, class: 'm-steel' }, svg);
      el('rect', { x: 476, y: 60, width: 118, height: 24, class: 'm-steel' }, svg);
      // Zylinder A (Spannen) links
      el('rect', { x: 200, y: 290, width: 120, height: 34, rx: 4, class: 'm-cyl' }, svg);
      const clampRod = el('rect', { x: 320, y: 302, width: 10, height: 10, class: 'm-rod' }, svg);
      const jaw = el('rect', { x: 330, y: 284, width: 12, height: 46, class: 'm-jaw' }, svg);
      el('text', { x: 260, y: 312, class: 'm-label', 'text-anchor': 'middle' }, svg).textContent = 'A';
      // Werkstück
      const piece = el('rect', { x: 400, y: 290, width: 110, height: 40, class: 'm-piece' }, svg);
      const hole = el('rect', { x: 488, y: 290, width: 12, height: 0, class: 'm-hole' }, svg);
      el('rect', { x: 600, y: 270, width: 30, height: 60, class: 'm-steel' }, svg);
      // Bohreinheit an Zylinder B
      el('rect', { x: 470, y: 84, width: 36, height: 50, rx: 4, class: 'm-cyl' }, svg);
      el('text', { x: 488, y: 114, class: 'm-label', 'text-anchor': 'middle' }, svg).textContent = 'B';
      const carriage = el('g', {}, svg);
      el('rect', { x: 484, y: 134, width: 8, height: 30, class: 'm-rod' }, carriage);
      el('rect', { x: 466, y: 164, width: 44, height: 56, rx: 8, class: 'm-motor' }, carriage);
      el('text', { x: 488, y: 197, class: 'm-label light', 'text-anchor': 'middle' }, carriage).textContent = 'M1';
      const chuck = el('g', {}, carriage);
      el('rect', { x: 482, y: 220, width: 12, height: 12, class: 'm-steel' }, chuck);
      const bitLine = el('line', { x1: 488, y1: 232, x2: 488, y2: 270, class: 'm-bit' }, carriage);
      const motorLed = el('circle', { cx: 520, cy: 172, r: 5, class: 'm-lamp' }, carriage);
      // Sensoren
      const lamps = [
        lamp(svg, 205, 270, 'B1', 'Ex.2'), lamp(svg, 315, 270, 'B2', 'Ex.3'),
        lamp(svg, 620, 120, 'B3', 'Ex.4'), lamp(svg, 620, 220, 'B4', 'Ex.5'), lamp(svg, 455, 370, 'B5', 'Ex.6'),
      ];
      // Ventile
      const valves = [
        valveSymbol(svg, 220, 360, 'Y1', 'Ax.0'), valveSymbol(svg, 290, 360, 'Y2', 'Ax.1'),
        valveSymbol(svg, 640, 20, 'Y3', 'Ax.2'), valveSymbol(svg, 640, 60, 'Y4', 'Ax.3'),
      ];
      refs = { clampRod, jaw, carriage, bit: bitLine, chuck, piece, hole, lamps, valves, motorLed };
    },
    render(logic, ax) {
      const L = logic as BohrLogic;
      const ap = L.a.pos * 56;
      refs.clampRod.setAttribute('width', String(10 + ap));
      refs.jaw.setAttribute('x', String(330 + ap));
      refs.carriage.setAttribute('transform', `translate(0 ${L.b.pos * 64})`);
      refs.chuck.setAttribute('transform', `rotate(${L.motor.angle} 488 226)`);
      refs.motorLed.classList.toggle('on', L.motor.running);
      refs.piece.style.display = L.piece === 'none' ? 'none' : '';
      refs.piece.classList.toggle('broken', L.piece === 'broken');
      refs.hole.setAttribute('height', String(L.piece === 'drilled' ? 40 : L.depth * 40));
      const ex = L.ex;
      [2, 3, 4, 5, 6].forEach((b, i) => refs.lamps[i]!.classList.toggle('on', ((ex >> b) & 1) === 1));
      refs.valves.forEach((v, i) => v.classList.toggle('on', ((ax >> i) & 1) === 1));
    },
  };
};

export const bohr: ExternalModelDef = {
  id: 'ext-bohr',
  name: 'Bohrvorrichtung',
  group: 'Modellpaket 1',
  desc: 'Nach START wird das Werkstück gespannt (Zylinder A), die laufende Bohrmaschine abgesenkt (Zylinder B), wieder angehoben und das Werkstück gelöst.',
  ax: ['Y1 Zylinder A ausfahren (spannen)', 'Y2 Zylinder A einfahren (lösen)', 'Y3 Zylinder B ausfahren (Bohrer ab)', 'Y4 Zylinder B einfahren (Bohrer auf)', 'M1 Bohrmotor', '', '', ''],
  ex: ['S1 Taster START', 'S2 Taster RESET', 'B1 Zylinder A eingefahren', 'B2 Zylinder A ausgefahren', 'B3 Bohrer oben', 'B4 Bohrer unten', 'B5 Werkstück vorhanden', ''],
  width: 720,
  height: 460,
  createLogic: () => new BohrLogic(),
  createView: view,
};
