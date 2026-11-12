import { el } from '../../kit.ts';
import type { ExternalModelDef, ModelView } from '../frame.ts';
import { LAYER_CAP, PALLET_CAP, PalettiererLogic } from './palettierer.logic.ts';
import { lamp, motorSymbol, panelButton, valveSymbol } from './parts.ts';
import { rc, tx } from './p2.parts.ts';

const X0 = 40, XSPAN = 390, BW = 56, BH = 34, CONV_Y = 308, COL_X = 356, SLOT_Y = 216, TRAVEL2 = 130;

const view = (): ModelView => {
  let r: {
    boxes: SVGRectElement[]; layer: SVGRectElement[]; palTop: SVGRectElement[]; stack: SVGRectElement[];
    rod1: SVGRectElement; rod2: SVGRectElement; plate: SVGRectElement; motor: ReturnType<typeof motorSymbol>;
    valves: SVGGElement[]; lamps: SVGCircleElement[]; belt: SVGLineElement; full: SVGTextElement;
  };
  let shift = 0, prevLayer = 0, prevPos = 0;
  return {
    mount(svg, logic) {
      const L = logic as PalettiererLogic;
      rc(svg, 0, 0, 720, 460, 'm-bg');
      // Bedienfeld
      rc(svg, 14, 10, 196, 172, 'm-panel', 10);
      panelButton(svg, 28, 20, 'S1', 'START', 'm-btn-green', (d) => L.input('start', d), 'Ex.0');
      panelButton(svg, 28, 74, '', 'Karton auflegen', 'm-btn-grey', (d) => L.input('box', d), '', 166);
      panelButton(svg, 28, 124, '', 'Palette wechseln', 'm-btn-grey', (d) => L.input('pallet', d), '', 166);
      // Förderband
      rc(svg, 28, 290, 424, 52, 'p2-belt-bed');
      for (let x = 34; x < 440; x += 20) rc(svg, x, 294, 12, 44, 'p2-roller', 2);
      const belt = el('line', { x1: 34, y1: 316, x2: 446, y2: 316, class: 'p2-beltline' }, svg);
      rc(svg, 446, 284, 10, 64, 'm-steel');
      // Magazin und Palette (Draufsicht)
      rc(svg, 346, 126, 76, 164, 'p2-shaft');
      rc(svg, 470, 126, 224, 164, 'p2-pallet');
      tx(svg, 582, 118, 'Palette (Draufsicht)', 'm-label small', 'middle');
      // Zylinder 1 (von unten schiebend)
      rc(svg, 364, 372, 40, 24, 'm-cyl', 3);
      tx(svg, 384, 389, '1', 'm-label light', 'middle');
      const rod1 = rc(svg, 380, 336, 8, 36, 'm-rod');
      // Zylinder 2 (seitlich schiebend)
      rc(svg, 226, 172, 84, 30, 'm-cyl', 3);
      tx(svg, 268, 192, '2', 'm-label light', 'middle');
      const rod2 = rc(svg, 310, 183, 20, 8, 'm-rod');
      const plate = rc(svg, 332, 126, 10, 164, 'm-jaw');
      // Boxen (Pools)
      const boxes = Array.from({ length: 8 }, () => rc(svg, 0, 0, BW, BH, 'm-box', 2));
      const layer = Array.from({ length: LAYER_CAP }, () => rc(svg, COL_X, 0, BW, BH, 'm-box', 2));
      const palTop = Array.from({ length: LAYER_CAP }, (_, k) => rc(svg, 500, SLOT_Y - k * 40, BW, BH, 'm-box', 2));
      // Palette seitlich (Stapel)
      rc(svg, 590, 438, 110, 10, 'p2-wood');
      const stack = Array.from({ length: PALLET_CAP }, (_, k) => rc(svg, 596, 436 - (k + 1) * 28, 98, 26, 'm-box', 2));
      const full = tx(svg, 645, 312, '', 'm-label small', 'middle');
      const motor = motorSymbol(svg, 70, 384, 'M1', 'Ax.4', 18);
      const valves = [valveSymbol(svg, 20, 420, '1Y1', 'Ax.0'), valveSymbol(svg, 84, 420, '1Y2', 'Ax.1'),
        valveSymbol(svg, 148, 420, '2Y1', 'Ax.2'), valveSymbol(svg, 212, 420, '2Y2', 'Ax.3')];
      const lamps = [['S2', 'Ex.1'], ['1S1', 'Ex.2'], ['1S2', 'Ex.3'], ['2S1', 'Ex.4'], ['2S2', 'Ex.5'], ['S3', 'Ex.6'], ['S4', 'Ex.7']]
        .map(([t, io], i) => lamp(svg, 306 + i * 40, 424, t!, io!));
      r = { boxes, layer, palTop, stack, rod1, rod2, plate, motor, valves, lamps, belt, full };
    },
    render(logic, ax) {
      const L = logic as PalettiererLogic;
      // Kartons auf dem Band
      r.boxes.forEach((b, i) => {
        const p = L.boxes[i];
        b.style.display = p === undefined ? 'none' : '';
        if (p === undefined) return;
        const atEnd = p >= 0.84;
        b.setAttribute('x', String(X0 + p * XSPAN - BW / 2));
        b.setAttribute('y', String(atEnd && L.c1.pos > 0 ? CONV_Y - 92 * L.c1.pos : CONV_Y));
      });
      // Lage im Schacht (mit Nachschieben)
      if (L.layer > prevLayer) shift = CONV_Y - 92 * 0.6 - SLOT_Y;
      if (L.layer === 0) shift = 0;
      if (L.c1.pos > prevPos) shift = Math.max(0, shift - (L.c1.pos - prevPos) * 92);
      prevLayer = L.layer; prevPos = L.c1.pos;
      const dx = L.layer > 0 ? L.c2.pos * TRAVEL2 : 0;
      r.layer.forEach((b, k) => {
        b.style.display = k < L.layer ? '' : 'none';
        b.setAttribute('x', String(COL_X + dx));
        b.setAttribute('y', String(SLOT_Y - k * 40 + shift));
      });
      r.palTop.forEach((b) => { b.style.display = L.pallet > 0 ? '' : 'none'; });
      r.stack.forEach((b, k) => { b.style.display = k < L.pallet ? '' : 'none'; });
      r.full.textContent = L.pallet >= PALLET_CAP ? 'Palette voll' : `Lagen: ${L.pallet} / ${PALLET_CAP}`;
      // Zylinder
      r.rod1.setAttribute('y', String(336 - 92 * L.c1.pos));
      r.rod1.setAttribute('height', String(36 + 92 * L.c1.pos));
      r.rod2.setAttribute('width', String(20 + TRAVEL2 * L.c2.pos));
      r.plate.setAttribute('x', String(332 + TRAVEL2 * L.c2.pos));
      r.motor.update(L.motor.running, L.motor.angle);
      r.belt.classList.toggle('on', L.motor.running);
      r.valves.forEach((v, i) => v.classList.toggle('on', ((ax >> i) & 1) === 1));
      [1, 2, 3, 4, 5, 6, 7].forEach((b, i) => r.lamps[i]!.classList.toggle('on', ((L.ex >> b) & 1) === 1));
    },
  };
};

export const palettierer: ExternalModelDef = {
  id: 'ext-palettierer',
  name: 'Palettierungsanlage',
  group: 'Modellpaket 2',
  desc: 'Kartons laufen auf dem Band bis zum Anschlag. Zylinder 1 schiebt sie in den Lagenschacht, Zylinder 2 schiebt eine volle Lage (3 Kartons) auf die Palette. 4 Lagen füllen eine Palette. Die Zylinder dürfen nicht gleichzeitig ausgefahren sein.',
  ax: ['1Y1 Zylinder 1 ausfahren', '1Y2 Zylinder 1 einfahren', '2Y1 Zylinder 2 ausfahren', '2Y2 Zylinder 2 einfahren', 'M1 Fördermotor', '', '', ''],
  ex: ['S1 Taster START', 'S2 Karton am Anschlag', '1S1 Zylinder 1 eingefahren', '1S2 Zylinder 1 ausgefahren', '2S1 Zylinder 2 eingefahren', '2S2 Zylinder 2 ausgefahren', 'S3 Lage voll', 'S4 Palette voll'],
  width: 720,
  height: 460,
  createLogic: () => new PalettiererLogic(),
  createView: view,
};
