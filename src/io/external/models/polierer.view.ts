import { el } from '../../kit.ts';
import type { ExternalModelDef, ModelView } from '../frame.ts';
import { PoliererLogic } from './polierer.logic.ts';
import { lamp, motorSymbol, panelButton } from './parts.ts';
import { rc, tx } from './p2.parts.ts';

const L0 = 50, D = 330, BINS = 10;

const view = (): ModelView => {
  let r: {
    carriage: SVGGElement; bins: SVGRectElement[]; disc: SVGLineElement; spindle: SVGLineElement; m1: ReturnType<typeof motorSymbol>;
    m2: ReturnType<typeof motorSymbol>; h1: SVGCircleElement; h2: SVGCircleElement; lamps: SVGCircleElement[]; cnt: SVGTextElement; t1: SVGRectElement; t2: SVGRectElement;
  };
  return {
    mount(svg, logic) {
      const L = logic as PoliererLogic;
      rc(svg, 0, 0, 720, 460, 'm-bg');
      // Bedienfeld
      rc(svg, 470, 14, 236, 122, 'm-panel', 10);
      panelButton(svg, 484, 24, 'S1', 'START', 'm-btn-green', (d) => L.input('start', d), 'Ex.0');
      panelButton(svg, 484, 76, 'S2', 'STOP', 'm-btn-red', (d) => L.input('stop', d), 'Ex.1');
      const h1 = lamp(svg, 650, 52, 'H1 Betrieb', 'Ax.0', 'green');
      const h2 = lamp(svg, 650, 108, 'H2 Störung', 'Ax.1', 'red');
      // Fehlerinjektion
      panelButton(svg, 14, 14, '', 'M1 überhitzen', 'm-btn-grey', (d) => L.input('heat1', d), '', 150);
      panelButton(svg, 14, 62, '', 'M2 überhitzen', 'm-btn-grey', (d) => L.input('heat2', d), '', 150);
      panelButton(svg, 14, 110, '', 'Neues Werkstück', 'm-btn-grey', (d) => L.input('piece', d), '', 150);
      // Gestell + Poliermotor M2
      rc(svg, 300, 150, 160, 10, 'm-steel');
      rc(svg, 370, 160, 20, 14, 'm-steel');
      rc(svg, 354, 174, 52, 60, 'm-motor', 8);
      const m2 = motorSymbol(svg, 380, 204, '', '', 16);
      el('text', { x: 412, y: 200, class: 'm-label small' }, svg).textContent = 'M2';
      el('text', { x: 412, y: 213, class: 'm-io' }, svg).textContent = 'Ax.4';
      rc(svg, 375, 234, 10, 62, 'm-rod');
      const disc = el('line', { x1: 342, y1: 301, x2: 418, y2: 301, class: 'p2-disc' }, svg);
      // Bett, Spindel und Schlitten
      rc(svg, 10, 346, 700, 30, 'p2-bed');
      const spindle = el('line', { x1: 44, y1: 394, x2: 706, y2: 394, class: 'p2-spindle' }, svg);
      rc(svg, 10, 340, 34, 62, 'm-motor', 6);
      const m1 = motorSymbol(svg, 27, 371, 'M1', '', 12);
      tx(svg, 14, 414, 'M1R Ax.2 · M1L Ax.3', 'm-io');
      const carriage = el('g', {}, svg);
      rc(carriage, 0, 328, D, 18, 'p2-carriage', 2);
      rc(carriage, D / 2 - 10, 376, 20, 18, 'p2-carriage');
      const bins = Array.from({ length: BINS }, (_, i) => rc(carriage, (BINS - 1 - i) * (D / BINS), 308, D / BINS, 20, 'p2-bin'));
      const cnt = tx(svg, 470, 170, '', 'm-label');
      // Sensorlampen
      const lamps = [
        lamp(svg, 60, 440, 'S3 links', 'Ex.2'), lamp(svg, 660, 440, 'S4 rechts', 'Ex.3'),
        lamp(svg, 470, 215, 'S5 M2 heiß', 'Ex.4', 'red'), lamp(svg, 380, 440, 'S6 Mitte', 'Ex.5'),
        lamp(svg, 90, 290, 'S7 M1 heiß', 'Ex.6', 'red'), lamp(svg, 520, 440, 'S8 Werkstück', 'Ex.7'),
      ];
      const t1 = rc(svg, 70, 276, 0, 5, 'p2-temp'), t2 = rc(svg, 500, 214, 0, 5, 'p2-temp');
      r = { carriage, bins, disc, spindle, m1, m2, h1, h2, lamps, cnt, t1, t2 };
    },
    render(logic) {
      const L = logic as PoliererLogic;
      r.carriage.setAttribute('transform', `translate(${L0 + L.pos * D} 0)`);
      L.finish.forEach((f, i) => {
        const b = r.bins[i]!;
        b.style.fill = L.piece ? `hsl(210 ${12 - f * 8}% ${38 + f * 48}%)` : 'none';
      });
      r.disc.style.strokeDashoffset = String(-L.m2.angle / 6);
      r.disc.classList.toggle('on', L.m2.speed > 0.1);
      r.spindle.style.strokeDashoffset = String(L.m1.angle / 20 * (L.dir || 1));
      r.m1.update(L.dir !== 0, L.m1.angle);
      r.m2.update(L.m2.running, L.m2.angle);
      r.h1.classList.toggle('on', L.lampOp);
      r.h2.classList.toggle('on', L.lampFault);
      const ex = L.ex;
      [2, 3, 4, 5, 6, 7].forEach((b, i) => r.lamps[i]!.classList.toggle('on', ((ex >> b) & 1) === 1));
      r.cnt.textContent = `Poliert: ${L.polished}`;
      r.t1.setAttribute('width', String(L.temp1 * 40));
      r.t2.setAttribute('width', String(L.temp2 * 40));
    },
  };
};

export const polierer: ExternalModelDef = {
  id: 'ext-polierer',
  name: 'Poliermaschine',
  group: 'Modellpaket 2',
  desc: 'Ein Schlitten (Motor M1 rechts/links) fährt das Werkstück unter der Polierscheibe M2 hindurch. Poliert wird nur bei laufender Scheibe, mit zwei Durchgängen. Die Schaltflächen „überhitzen" lösen die Übertemperatursensoren aus.',
  ax: ['H1 Meldelampe Betrieb', 'H2 Meldelampe Störung', 'M1R Schlitten rechts', 'M1L Schlitten links', 'M2 Polierscheibe', '', '', ''],
  ex: ['S1 Taster START', 'S2 Taster STOP', 'S3 Schlitten links', 'S4 Schlitten rechts', 'S5 M2 Übertemperatur', 'S6 Schlitten unter der Scheibe', 'S7 M1 Übertemperatur', 'S8 Werkstück eingespannt'],
  width: 720,
  height: 460,
  createLogic: () => new PoliererLogic(),
  createView: view,
};
