import { el } from '../../kit.ts';
import type { ExternalModelDef, ModelView } from '../frame.ts';
import { ANG_B1, ARC, DrehrichtungLogic, SENSOR_GAP } from './drehrichtung.logic.ts';
import { lamp, panelSwitch } from './parts.ts';
import { rc, tx } from './p2.parts.ts';
import { faultButton } from './p1.parts.ts';
import { segButton } from './p3.parts.ts';

const CX = 330, CY = 250, R = 120;
const pt = (deg: number, r: number) => [CX + r * Math.cos((deg * Math.PI) / 180), CY + r * Math.sin((deg * Math.PI) / 180)] as const;

const view = (): ModelView => {
  let r: {
    wheel: SVGGElement; s: SVGGElement[]; sb: SVGRectElement[]; h: SVGCircleElement[]; f: ReturnType<typeof faultButton>[];
    dir: ReturnType<typeof segButton>[];
  };
  return {
    mount(svg, logic) {
      const L = logic as DrehrichtungLogic;
      rc(svg, 0, 0, 720, 460, 'm-bg');
      rc(svg, 14, 14, 170, 60, 'm-panel', 10);
      panelSwitch(svg, 26, 24, 'S0', 'EIN', (on) => L.input('s0', on), 'Ex.0');
      // Richtungswahl
      tx(svg, 30, 150, 'Drehrichtung', 'm-label');
      const dr = segButton(svg, 30, 160, 110, 32, '↻ Rechtslauf', () => L.input('rechts', true));
      const dl = segButton(svg, 30, 200, 110, 32, '↺ Linkslauf', () => L.input('links', true));
      // Scheibe
      el('circle', { cx: CX, cy: CY, r: R + 10, fill: '#8a949e', opacity: 0.25 }, svg);
      const wheel = el('g', { transform: `rotate(0 ${CX} ${CY})` }, svg);
      el('circle', { cx: CX, cy: CY, r: R, class: 'p3-wheel' }, wheel);
      const [x0, y0] = pt(0, R - 6), [x1, y1] = pt(ARC, R - 6), [x2, y2] = pt(ARC, R - 40), [x3, y3] = pt(0, R - 40);
      el('path', { d: `M${x0} ${y0} A${R - 6} ${R - 6} 0 0 1 ${x1} ${y1} L${x2} ${y2} A${R - 40} ${R - 40} 0 0 0 ${x3} ${y3} Z`, class: 'p3-arc' }, wheel);
      el('line', { x1: CX - 40, y1: CY, x2: CX + 40, y2: CY, stroke: '#6b737b', 'stroke-width': 2, opacity: 0.6 }, wheel);
      el('circle', { cx: CX, cy: CY, r: 6, fill: '#222' }, svg);
      // Sensoren am Umfang
      const s: SVGGElement[] = [], sb: SVGRectElement[] = [];
      [ANG_B1, ANG_B1 + SENSOR_GAP].forEach((a, i) => {
        const [px, py] = pt(a, R + 6);
        const g = el('g', { transform: `translate(${px} ${py}) rotate(${a})` }, svg);
        sb.push(rc(g, 0, -9, 34, 18, 'p3-sensor', 3));
        s.push(g);
        const [lx, ly] = pt(a, R + 52);
        tx(svg, lx + 4, ly + (i ? 12 : -2), `B${i + 1}`, 'm-label');
        tx(svg, lx + 4, ly + (i ? 24 : 10), `Ex.${i + 1}`, 'm-io');
      });
      // Meldeleuchten
      rc(svg, 556, 190, 148, 120, 'm-panel', 10);
      tx(svg, 630, 212, 'Drehrichtung', 'm-label', 'middle');
      const h = [lamp(svg, 578, 248, '', '', 'yellow'), lamp(svg, 578, 290, '', '', 'yellow')];
      tx(svg, 594, 247, '↻ H1 rechts', 'm-label small');
      tx(svg, 594, 259, 'Ax.0', 'm-io');
      tx(svg, 594, 289, '↺ H2 links', 'm-label small');
      tx(svg, 594, 301, 'Ax.1', 'm-io');
      // Störungs-Taster
      const f = [
        faultButton(svg, 468, 130, 'Sensor B1 defekt', () => L.input('b1', !L.b1Fault)),
        faultButton(svg, 468, 370, 'Sensor B2 defekt', () => L.input('b2', !L.b2Fault)),
      ];
      tx(svg, 484, 124, 'B1 defekt', 'm-io', 'middle');
      tx(svg, 484, 412, 'B2 defekt', 'm-io', 'middle');
      r = { wheel, s, sb, h, f, dir: [dr, dl] };
    },
    render(logic) {
      const L = logic as DrehrichtungLogic;
      r.wheel.setAttribute('transform', `rotate(${L.phi} ${CX} ${CY})`);
      r.sb[0]!.classList.toggle('on', L.b1);
      r.sb[1]!.classList.toggle('on', L.b2);
      r.h[0]!.classList.toggle('on', L.h1);
      r.h[1]!.classList.toggle('on', L.h2);
      r.f[0]!.set(L.b1Fault); r.f[1]!.set(L.b2Fault);
      r.dir[0]!.set(L.dirSel === 1); r.dir[1]!.set(L.dirSel === -1);
    },
  };
};

export const drehrichtung: ExternalModelDef = {
  id: 'ext-drehrichtung',
  name: 'Drehrichtungserkennung',
  group: 'Modellpaket 2',
  desc: 'Eine Scheibe mit roter Fahne läuft an zwei Sensoren B1/B2 vorbei. Aus der Reihenfolge der Signale ist die Drehrichtung zu erkennen und mit H1 (rechts) bzw. H2 (links) anzuzeigen. Drehrichtung im Modellfenster wählbar. Modellvariante A: Schließer.',
  ax: ['H1 Drehrichtung rechts (↻)', 'H2 Drehrichtung links (↺)', '', '', '', '', '', ''],
  ex: ['S0 Schalter Antrieb EIN', 'B1 Sensor 1', 'B2 Sensor 2', '', '', '', '', ''],
  width: 720,
  height: 460,
  createLogic: () => new DrehrichtungLogic(),
  createView: view,
};
