import { el } from '../../kit.ts';
import type { ExternalModelDef, ModelView } from '../frame.ts';
import { BELT, BOX_LEN, KlebeLogic, NOZZLE } from './klebeduese.logic.ts';
import { lamp, panelButton, panelSwitch } from './parts.ts';
import { bow, digit, rc, tx } from './p2.parts.ts';

const X0 = 40, SPAN = 640, BY = 312, BH = 52;

const view = (): ModelView => {
  let r: { boxes: { g: SVGGElement; glue: SVGRectElement }[]; setDigit: (n: number) => void; valve: SVGGElement; drip: SVGLineElement; tube: SVGPathElement; s1: SVGCircleElement; spot: SVGEllipseElement; count: SVGTextElement; beam: SVGLineElement };
  return {
    mount(svg, logic) {
      const L = logic as KlebeLogic;
      rc(svg, 0, 0, 720, 460, 'm-bg');
      // Vorwahl
      rc(svg, 14, 14, 270, 150, 'm-panel', 10);
      tx(svg, 28, 36, 'Vorwahlgröße B1', 'm-label small');
      const setDigit = digit(svg, 46, 56, 34, 56);
      panelButton(svg, 110, 46, 'B1', 'größer', 'm-btn-grey', (d) => L.input('up', d), 'Ex.1–3');
      panelButton(svg, 110, 98, 'B1', 'kleiner', 'm-btn-grey', (d) => L.input('down', d), 'Ex.1–3');
      panelSwitch(svg, 14, 178, 'Auto', 'Karton-Automatik', (on) => L.input('auto', on));
      panelButton(svg, 14, 226, '', 'Karton auflegen', 'm-btn-grey', (d) => L.input('box', d), '', 150);
      // Förderband
      rc(svg, 20, 300, 680, 74, 'p2-belt-bed');
      for (let x = 26; x < 690; x += 20) rc(svg, x, 304, 12, 66, 'p2-roller', 2);
      el('line', { x1: 24, y1: 337, x2: 696, y2: 337, class: 'p2-beltline on' }, svg);
      // Kartons
      const boxes = Array.from({ length: 4 }, () => {
        const g = el('g', {}, svg);
        rc(g, 0, 0, BOX_LEN * SPAN, BH, 'm-box', 4);
        const glue = rc(g, 0, 18, 0, 16, 'p2-glue-strip', 3);
        return { g, glue };
      });
      // Düse
      const nx = X0 + NOZZLE * SPAN;
      const tube = el('path', { d: `M${nx} 14 V270 L${nx - 6} 296 H${nx + 6} L${nx} 270`, class: 'p2-tube-glue' }, svg);
      const valve = bow(svg, nx, 130, 'Y1', 'Ax.0', false);
      const drip = el('line', { x1: nx, y1: 296, x2: nx, y2: BY + 18, class: 'p2-stream p2-glue-line' }, svg);
      const spot = el('ellipse', { cx: nx, cy: 338, rx: 14, ry: 6, class: 'p2-glue-spot' }, svg);
      // Sensor
      const beam = el('line', { x1: nx + 24, y1: 380, x2: nx + 24, y2: 296, class: 'p2-beam' }, svg);
      rc(svg, nx + 14, 380, 20, 16, 'p2-sensor', 3);
      const s1 = lamp(svg, nx + 24, 420, 'S1 Karton', 'Ex.0');
      const count = tx(svg, 440, 60, '', 'm-label');
      tx(svg, 440, 84, 'Öffnungszeit = Vorwahl × 0,2 s', 'm-io');
      r = { boxes, setDigit, valve, drip, tube, s1, spot, count, beam };
    },
    render(logic) {
      const L = logic as KlebeLogic;
      r.setDigit(L.preset);
      r.boxes.forEach((b, i) => {
        const k = L.boxes[i];
        b.g.style.display = k === undefined ? 'none' : '';
        if (!k) return;
        b.g.setAttribute('transform', `translate(${X0 + (k.x - BOX_LEN / 2) * SPAN} ${BY})`);
        const w = Math.min(k.glue * BELT * SPAN, BOX_LEN * SPAN);
        b.glue.setAttribute('x', String(BOX_LEN * SPAN - w));
        b.glue.setAttribute('width', String(w));
      });
      r.valve.classList.toggle('on', L.nozzle);
      r.drip.style.display = L.nozzle ? '' : 'none';
      r.tube.classList.toggle('on', L.nozzle);
      r.spot.style.display = L.beltGlue > 0 ? '' : 'none';
      r.s1.classList.toggle('on', L.under);
      r.beam.classList.toggle('cut', L.under);
      r.count.textContent = `Richtig geklebt: ${L.good}   Falsch: ${L.bad}`;
    },
  };
};

export const klebeduese: ExternalModelDef = {
  id: 'ext-klebeduese',
  name: 'Klebedüse',
  group: 'Modellpaket 2',
  desc: 'Kartons laufen auf einem Band unter der Klebedüse durch. Die Düse Y1 soll genau (Vorwahl × 0,2 s) geöffnet werden, sobald der Sensor S1 einen Karton erkennt. Die Vorwahlgröße 0–7 liegt binär an Ex.1–Ex.3.',
  ax: ['Y1 Klebedüse öffnen', '', '', '', '', '', '', ''],
  ex: ['S1 Karton unter der Düse', 'B1 Vorwahl Bit 0 (Wertigkeit 1)', 'B1 Vorwahl Bit 1 (Wertigkeit 2)', 'B1 Vorwahl Bit 2 (Wertigkeit 4)', '', '', '', ''],
  width: 720,
  height: 460,
  createLogic: () => new KlebeLogic(),
  createView: view,
};
