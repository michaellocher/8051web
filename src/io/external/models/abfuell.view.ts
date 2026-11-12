import { el } from '../../kit.ts';
import type { ExternalModelDef, ModelView } from '../frame.ts';
import { AbfuellLogic } from './abfuell.logic.ts';
import { lamp, panelButton, panelSwitch, valveSymbol } from './parts.ts';
import { bow, rc, tx } from './p2.parts.ts';

const BX = (s: number) => 60 + 590 * s;
const SILO = (top: number) => {
  if (top <= 230) return `M330 ${top} H450 V230 L400 300 H380 L330 230 Z`;
  const d = ((top - 230) / 70) * 50;
  return `M${330 + d} ${top} H${450 - d} L400 300 H380 Z`;
};

const view = (): ModelView => {
  let r: {
    product: SVGPathElement; bottles: { g: SVGGElement; liq: SVGRectElement }[]; rollers: SVGGElement; lamps: SVGCircleElement[];
    valves: SVGGElement[]; y1: SVGGElement; puddle: SVGEllipseElement; stream: SVGLineElement; count: SVGTextElement; mag: SVGGElement[];
  };
  return {
    mount(svg, logic) {
      const L = logic as AbfuellLogic;
      rc(svg, 0, 0, 720, 460, 'm-bg');
      rc(svg, 20, 16, 290, 110, 'm-panel', 12);
      panelSwitch(svg, 36, 30, 'S1', 'Hauptschalter', (on) => L.input('main', on), 'Ex.0');
      tx(svg, 36, 84, '0 = Aus · I = Ein', 'm-io');
      const pLamp = lamp(svg, 262, 56, 'P Silo leer', 'Ax.7', 'red');
      // Magazin
      rc(svg, 52, 190, 96, 176, 'p4-wall', 3);
      const mag = [0, 1, 2].map((i) => {
        const g = el('g', { transform: `translate(${72} ${204 + i * 54})` }, svg);
        rc(g, 0, 8, 36, 40, 'p4-bottle', 8); rc(g, 11, 0, 14, 10, 'p4-bottle', 3);
        return g;
      });
      const y2 = valveSymbol(svg, 160, 340, 'Y2 Flasche frei', 'Ax.0');
      // Silo
      const product = el('path', { d: SILO(150), class: 'p4-product' }, svg);
      el('path', { d: 'M330 150 V230 L380 300 H400 L450 230 V150', class: 'p4-silo' }, svg);
      const s3 = lamp(svg, 296, 270, 'S3', 'Ex.2');
      el('line', { x1: 304, y1: 277, x2: 346, y2: 277, class: 'p4-beam' }, svg);
      const y1 = bow(svg, 390, 318, 'Y1', 'Ax.1', true);
      const stream = el('line', { x1: 390, y1: 326, x2: 390, y2: 400, class: 'p2-stream' }, svg);
      // Lichtschranke S2
      rc(svg, 350, 384, 8, 36, 'p2-sensor'); rc(svg, 422, 384, 8, 36, 'p2-sensor');
      const lamps = [pLamp, lamp(svg, 480, 340, 'S2', 'Ex.1'), s3];
      // Band
      rc(svg, 20, 420, 630, 22, 'p4-belt', 8);
      const rollers = el('g', {}, svg);
      for (let i = 0; i < 7; i++) {
        const gg = el('g', { transform: `translate(${60 + i * 90} 431)` }, rollers);
        el('circle', { r: 9, class: 'p4-roller' }, gg);
        el('path', { d: 'M-7 0 H7 M0 -7 V7', class: 'p4-spoke' }, gg);
      }
      tx(svg, 24, 456, 'M · Ax.2 Bandmotor', 'm-io');
      const puddle = el('ellipse', { cx: 390, cy: 418, rx: 0, ry: 4, class: 'p4-product' }, svg);
      // Flaschen
      const bottles = Array.from({ length: 8 }, () => {
        const g = el('g', {}, svg);
        rc(g, -18, 4, 36, 52, 'p4-bottle', 8); rc(g, -7, -4, 14, 10, 'p4-bottle', 3);
        const liq = rc(g, -18, 56, 36, 0, 'p4-product', 6);
        return { g, liq };
      });
      // Kiste
      rc(svg, 660, 396, 52, 46, 'p4-crate2', 3);
      const count = tx(svg, 700, 30, '', 'm-label small', 'end');
      panelButton(svg, 500, 120, '', 'Silo nachfüllen', 'm-btn-grey', (d) => L.input('refill', d), '', 150);
      r = { product, bottles, rollers, lamps, valves: [y2], y1, puddle, stream, count, mag };
    },
    render(logic, ax) {
      const L = logic as AbfuellLogic;
      r.product.setAttribute('d', SILO(300 - L.level * 150));
      r.product.style.display = L.level > 0.01 ? '' : 'none';
      r.bottles.forEach((b, i) => {
        const bt = L.bottles[i];
        b.g.style.display = bt ? '' : 'none';
        if (bt) {
          b.g.setAttribute('transform', `translate(${BX(bt.x)} ${364})`);
          const h = Math.min(1.15, bt.fill) * 34;
          b.liq.setAttribute('y', String(56 - h)); b.liq.setAttribute('height', String(h));
        }
      });
      r.rollers.querySelectorAll('g').forEach((g, i) => g.setAttribute('transform', `translate(${60 + i * 90} 431) rotate(${L.beltAngle})`));
      const ex = L.ex;
      r.lamps[0]!.classList.toggle('on', ((ax >> 7) & 1) === 1);
      r.lamps[1]!.classList.toggle('on', ((ex >> 1) & 1) === 1);
      r.lamps[2]!.classList.toggle('on', ((ex >> 2) & 1) === 1);
      r.valves[0]!.classList.toggle('on', (ax & 1) === 1);
      r.y1.classList.toggle('on', ((ax >> 1) & 1) === 1);
      const flowing = ((ax >> 1) & 1) === 1 && L.level > 0;
      r.stream.style.display = flowing ? '' : 'none';
      r.puddle.setAttribute('rx', String(Math.min(40, L.spilled * 25)));
      r.count.textContent = `Kiste: ${L.goodCount} gut · ${L.badCount} Ausschuss`;
      r.mag.forEach((g) => { g.style.display = ''; });
    },
  };
};

export const abfuell: ExternalModelDef = {
  id: 'ext-abfuell',
  name: 'Abfüllanlage',
  group: 'Modellpaket 2',
  desc: 'Flaschen werden aus dem Magazin aufs Band gesetzt, unter dem Silo gefüllt (nur zeitgesteuert, kein Füllstandssensor) und in eine Kiste befördert. Läuft Produkt ohne Flasche aus oder die Flasche über, wird gemeldet. Mit „Silo nachfüllen“ geht es nach „Silo leer“ weiter.',
  ax: ['Y2 Magazin: Flasche freigeben', 'Y1 Silo-Ventil öffnen', 'M Bandmotor', '', '', '', '', 'P Meldelampe „Silo leer“'],
  ex: ['S1 Hauptschalter (1 = Ein)', 'S2 Lichtschranke Füllplatz', 'S3 Silo-Füllstand (1 = nicht leer)', '', '', '', '', ''],
  width: 720,
  height: 460,
  createLogic: () => new AbfuellLogic(),
  createView: view,
};
