import { el } from '../../kit.ts';
import type { ExternalModelDef, ModelView } from '../frame.ts';
import { HebeLogic } from './hebe.logic.ts';
import { lamp, panelButton, valveSymbol } from './parts.ts';
import { rc, tx } from './p2.parts.ts';

const LIFT = 170;

const view = (): ModelView => {
  let r: {
    platform: SVGRectElement; rod: SVGRectElement; box: SVGGElement; upper: SVGGElement[]; head: SVGRectElement; bRod: SVGRectElement;
    lamps: SVGCircleElement[]; valves: SVGGElement[]; warn: SVGGElement; count: SVGTextElement;
  };
  const crate = (p: Element) => {
    const g = el('g', {}, p);
    rc(g, 0, 0, 64, 44, 'p4-crate', 3);
    el('path', { d: 'M0 0 L64 44 M64 0 L0 44', class: 'p4-crate-x' }, g);
    return g;
  };
  return {
    mount(svg, logic) {
      const L = logic as HebeLogic;
      rc(svg, 0, 0, 720, 460, 'm-bg');
      // Förderbänder
      rc(svg, 10, 360, 320, 20, 'p4-belt', 4);
      rc(svg, 394, 190, 316, 20, 'p4-belt', 4);
      for (let i = 0; i < 8; i++) el('circle', { cx: 30 + i * 40, cy: 370, r: 7, class: 'p4-roller' }, svg);
      for (let i = 0; i < 8; i++) el('circle', { cx: 414 + i * 40, cy: 200, r: 7, class: 'p4-roller' }, svg);
      rc(svg, 394, 210, 8, 20, 'm-steel');
      // Zylinder A (Hubtisch) unten
      rc(svg, 342, 392, 40, 58, 'm-cyl', 4);
      tx(svg, 362, 426, 'A', 'm-label light', 'middle');
      const rod = rc(svg, 358, 370, 8, 22, 'm-rod');
      const platform = rc(svg, 330, 360, 64, 10, 'p4-pad');
      // Zylinder B (Schieber) oben links
      rc(svg, 60, 152, 150, 34, 'm-cyl', 4);
      tx(svg, 135, 175, 'B', 'm-label light', 'middle');
      const bRod = rc(svg, 210, 164, 60, 10, 'm-rod');
      const head = rc(svg, 266, 146, 10, 44, 'p4-pad');
      // Kisten
      const box = crate(svg);
      const upper = [crate(svg), crate(svg), crate(svg)];
      // Sensoren
      const lamps = [
        lamp(svg, 262, 296, 'B0', 'Ex.0'), lamp(svg, 450, 430, 'B1', 'Ex.1'), lamp(svg, 450, 290, 'B2', 'Ex.2'),
        lamp(svg, 90, 106, 'B3', 'Ex.3'), lamp(svg, 190, 106, 'B4', 'Ex.4'),
      ];
      // Ventile
      rc(svg, 520, 330, 180, 100, 'm-panel', 10);
      tx(svg, 534, 350, 'Federrückstellung', 'm-label small');
      const valves = [valveSymbol(svg, 538, 366, 'Y1 A hoch', 'Ax.0'), valveSymbol(svg, 538, 396, 'Y2 B vor', 'Ax.1')];
      panelButton(svg, 24, 398, 'S1', 'RESET', 'm-btn-blue', (d) => L.input('s1', d), 'Ex.5');
      const warn = el('g', { class: 'p2-warn', transform: 'translate(200 270)' }, svg);
      el('path', { d: 'M0 -26 L26 20 L-26 20 Z', class: 'p2-warn-tri' }, warn);
      tx(warn, 0, 14, '!', 'p2-warn-text', 'middle');
      const count = tx(svg, 700, 40, '', 'm-label', 'end');
      r = { platform, rod, box, upper, head, bRod, lamps, valves, warn, count };
    },
    render(logic, ax) {
      const L = logic as HebeLogic;
      const top = 360 - LIFT * L.a.pos;
      r.platform.setAttribute('y', String(top));
      r.rod.setAttribute('y', String(top + 10));
      r.rod.setAttribute('height', String(392 - top - 10));
      const hx = 266 + L.b.pos * 70;
      r.head.setAttribute('x', String(hx));
      r.bRod.setAttribute('width', String(hx - 210));
      // Kiste
      const g = r.box;
      g.style.display = L.stage === 'none' ? 'none' : '';
      if (L.stage === 'belt') g.setAttribute('transform', `translate(${10 + 316 * L.s - 64 + 20 * 0} ${316})`);
      if (L.stage === 'platform') g.setAttribute('transform', `translate(${330 + (L.b.pos > 0.2 ? (L.b.pos) * 66 : 0)} ${top - 44})`);
      if (L.stage === 'fallen') g.setAttribute('transform', 'translate(380 406) rotate(14)');
      r.upper.forEach((u, i) => {
        const p = L.upper[i];
        u.style.display = p === undefined ? 'none' : '';
        if (p !== undefined) u.setAttribute('transform', `translate(${396 + p * 300} 146)`);
      });
      const ex = L.ex;
      [0, 1, 2, 3, 4].forEach((b, i) => r.lamps[i]!.classList.toggle('on', ((ex >> b) & 1) === 1));
      r.valves.forEach((v, i) => v.classList.toggle('on', ((ax >> i) & 1) === 1));
      r.warn.classList.toggle('on', L.faulted || L.status.startsWith('Kollision'));
      r.count.textContent = `Gehoben: ${L.done}`;
    },
  };
};

export const hebe: ExternalModelDef = {
  id: 'ext-hebe',
  name: 'Hebevorrichtung',
  group: 'Modellpaket 2',
  desc: 'Kisten kommen auf dem unteren Band an. Zylinder A hebt sie auf Höhe des oberen Bandes, Zylinder B schiebt sie hinüber. Schiebt B zu früh oder steht B im Hubweg, gibt es eine Störung (RESET quittiert).',
  ax: ['Y1 Zylinder A ausfahren (Hubtisch hoch)', 'Y2 Zylinder B ausfahren (Kiste schieben)', '', '', '', '', '', ''],
  ex: ['B0 Kiste am Hubtisch', 'B1 Zylinder A eingefahren (unten)', 'B2 Zylinder A ausgefahren (oben)', 'B3 Zylinder B eingefahren', 'B4 Zylinder B ausgefahren', 'S1 Taster RESET', '', ''],
  width: 720,
  height: 460,
  createLogic: () => new HebeLogic(),
  createView: view,
};
