import { el } from '../../kit.ts';
import type { ExternalModelDef, ModelView } from '../frame.ts';
import { B_CONTACT, BiegeLogic } from './biege.logic.ts';
import { lamp, panelButton, valveSymbol } from './parts.ts';
import { rc, tx } from './p2.parts.ts';

const FLAP = 70;

const view = (): ModelView => {
  let r: {
    aRod: SVGRectElement; aPad: SVGRectElement; bRod: SVGRectElement; bPad: SVGRectElement; cRod: SVGRectElement; cHead: SVGRectElement;
    piece: SVGGElement; flat: SVGRectElement; flap: SVGGElement; flapRect: SVGRectElement; lamps: SVGCircleElement[]; valves: SVGGElement[]; count: SVGTextElement;
  };
  return {
    mount(svg, logic) {
      const L = logic as BiegeLogic;
      rc(svg, 0, 0, 720, 460, 'm-bg');
      const defs = el('defs', {}, svg);
      const pat = el('pattern', { id: 'p4-hatch-biege', width: 8, height: 8, patternUnits: 'userSpaceOnUse', patternTransform: 'rotate(45)' }, defs);
      el('rect', { width: 8, height: 8, fill: '#e3e7ea' }, pat);
      el('line', { x1: 0, y1: 0, x2: 0, y2: 8, stroke: '#555', 'stroke-width': 2 }, pat);
      // Bedienfeld
      rc(svg, 20, 20, 200, 120, 'm-panel', 10);
      panelButton(svg, 36, 34, 'S0', 'START', 'm-btn-green', (d) => L.input('start', d), 'Ex.0');
      panelButton(svg, 36, 84, 'S1', 'STOP', 'm-btn-red', (d) => L.input('stop', d), 'Ex.1');
      // Werkzeug
      rc(svg, 360, 280, 200, 120, 'p4-die', 3).setAttribute('fill', 'url(#p4-hatch-biege)');
      rc(svg, 340, 400, 240, 14, 'm-steel');
      // Blech: Platte + abgebogener Rand
      const piece = el('g', {}, svg);
      const flat = rc(piece, 360, 266, 190, 12, 'p4-sheet');
      const flap = el('g', { transform: 'translate(360 272)' }, piece);
      const flapRect = rc(flap, -FLAP, -6, FLAP, 12, 'p4-sheet');
      // Zylinder A (Niederhalter)
      rc(svg, 440, 40, 40, 90, 'm-cyl', 4);
      tx(svg, 460, 92, 'A', 'm-label light', 'middle');
      const aRod = rc(svg, 456, 130, 8, 40, 'm-rod');
      const aPad = rc(svg, 434, 160, 52, 12, 'p4-pad');
      // Zylinder B (Biegestempel)
      rc(svg, 300, 40, 40, 90, 'm-cyl', 4);
      tx(svg, 320, 92, 'B', 'm-label light', 'middle');
      const bRod = rc(svg, 316, 130, 8, 40, 'm-rod');
      const bPad = rc(svg, 292, 160, 56, 14, 'p4-pad');
      // Zylinder C (Auswerfer) von rechts
      rc(svg, 596, 248, 112, 48, 'm-cyl', 4);
      tx(svg, 660, 278, 'C', 'm-label light', 'middle');
      const cRod = rc(svg, 580, 268, 20, 8, 'm-rod');
      const cHead = rc(svg, 566, 256, 14, 32, 'p4-pad');
      // Sensoren
      const lamps = [
        lamp(svg, 520, 60, 'B1', 'Ex.2'), lamp(svg, 520, 150, 'B2', 'Ex.3'),
        lamp(svg, 262, 60, 'B3', 'Ex.4'), lamp(svg, 262, 150, 'B4', 'Ex.5'),
        lamp(svg, 630, 334, 'B5', 'Ex.6'), lamp(svg, 684, 334, 'B6', 'Ex.7'),
      ];
      // Ventile
      rc(svg, 20, 330, 300, 112, 'm-panel', 10);
      tx(svg, 32, 348, 'Impulsventile (Spulen)', 'm-label small');
      const valves: SVGGElement[] = [];
      for (const [col, tag] of ['A', 'B', 'C'].entries()) {
        const x = 40 + col * 96;
        tx(svg, x, 372, tag, 'm-label');
        valves.push(valveSymbol(svg, x + 14, 358, `Y${col * 2 + 1}`, `Ax.${col * 2}`));
        valves.push(valveSymbol(svg, x + 14, 394, `Y${col * 2 + 2}`, `Ax.${col * 2 + 1}`));
      }
      panelButton(svg, 360, 420, '', 'Neues Blech einlegen', 'm-btn-grey', (d) => L.input('reset', d), '', 170);
      const count = tx(svg, 20, 160, '', 'm-label small');
      r = { aRod, aPad, bRod, bPad, cRod, cHead, piece, flat, flap, flapRect, lamps, valves, count };
    },
    render(logic, ax) {
      const L = logic as BiegeLogic;
      const aBottom = 172 + L.a.pos * 94;
      r.aPad.setAttribute('y', String(aBottom - 12));
      r.aRod.setAttribute('height', String(aBottom - 12 - 130));
      const bBottom = L.b.pos <= B_CONTACT ? 172 + (L.b.pos / B_CONTACT) * 90 : 262 + ((L.b.pos - B_CONTACT) / (1 - B_CONTACT)) * 80;
      r.bPad.setAttribute('y', String(bBottom - 14));
      r.bRod.setAttribute('height', String(bBottom - 14 - 130));
      const headX = 580 - L.c.pos * 155;
      r.cHead.setAttribute('x', String(headX));
      r.cRod.setAttribute('x', String(headX + 14));
      r.cRod.setAttribute('width', String(Math.max(0, 600 - headX - 14)));
      r.piece.style.display = L.blech === 'none' ? 'none' : '';
      r.piece.setAttribute('transform', `translate(${-L.push * 124} 0)`);
      r.flap.setAttribute('transform', `translate(360 272) rotate(${-L.bend * 88})`);
      r.flat.classList.toggle('broken', L.blech === 'ruined');
      r.flapRect.classList.toggle('broken', L.blech === 'ruined');
      const ex = L.ex;
      [2, 3, 4, 5, 6, 7].forEach((b, i) => r.lamps[i]!.classList.toggle('on', ((ex >> b) & 1) === 1));
      r.valves.forEach((v, i) => v.classList.toggle('on', ((ax >> i) & 1) === 1));
      r.count.textContent = `Gebogen: ${L.bentCount} · Ausschuss: ${L.ruinedCount}`;
    },
  };
};

export const biege: ExternalModelDef = {
  id: 'ext-biege',
  name: 'Biegevorrichtung',
  group: 'Modellpaket 2',
  desc: 'Nach START spannt Zylinder A den Blechstreifen, Zylinder B biegt den Rand nach unten, danach fährt A hoch und Zylinder C wirft das fertige Teil aus. Wird nicht gespannt oder zu früh ausgeworfen, gibt es Ausschuss oder eine Störung.',
  ax: ['Y1 Zylinder A ausfahren (Niederhalter ab)', 'Y2 Zylinder A einfahren', 'Y3 Zylinder B ausfahren (biegen)', 'Y4 Zylinder B einfahren', 'Y5 Zylinder C ausfahren (auswerfen)', 'Y6 Zylinder C einfahren', '', ''],
  ex: ['S0 Taster START', 'S1 Taster STOP', 'B1 Zylinder A eingefahren', 'B2 Zylinder A ausgefahren', 'B3 Zylinder B eingefahren', 'B4 Zylinder B ausgefahren', 'B5 Zylinder C eingefahren', 'B6 Zylinder C ausgefahren'],
  width: 720,
  height: 460,
  createLogic: () => new BiegeLogic(),
  createView: view,
};
