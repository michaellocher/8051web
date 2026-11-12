import { el } from '../../kit.ts';
import type { ExternalModelDef, ModelView } from '../frame.ts';
import { RollenbahnLogic } from './rollenbahn.logic.ts';
import { lamp, panelButton, valveSymbol } from './parts.ts';
import { rc, tx } from './p2.parts.ts';

const Y_HIGH = 150, Y_LOW = 380, PX = 450, PW = 84, PH = 44, PUSH = 120;

const view = (): ModelView => {
  let r: { platform: SVGRectElement; pkg: SVGGElement; rod1: SVGRectElement; plate: SVGRectElement; rod2: SVGRectElement; out: SVGGElement[]; valves: SVGGElement[]; lamps: SVGCircleElement[]; count: SVGTextElement };
  const parcel = (p: Element) => {
    const g = el('g', {}, p);
    rc(g, 0, 0, PW, PH, 'm-box', 3);
    rc(g, PW / 2 - 4, 0, 8, PH, 'p2-tape');
    return g;
  };
  return {
    mount(svg, logic) {
      const L = logic as RollenbahnLogic;
      rc(svg, 0, 0, 720, 460, 'm-bg');
      // obere Abtransport-Rollenbahn
      rc(svg, 50, Y_HIGH, 390, 28, 'p2-belt-bed');
      for (let x = 58; x < 430; x += 20) rc(svg, x, Y_HIGH + 3, 12, 22, 'p2-roller', 2);
      tx(svg, 60, 196, 'zur Verpackung', 'm-label small');
      // untere Zuführbahn
      rc(svg, 50, Y_LOW + 10, 390, 28, 'p2-belt-bed');
      for (let x = 58; x < 430; x += 20) rc(svg, x, Y_LOW + 13, 12, 22, 'p2-roller', 2);
      // Hubschacht
      rc(svg, 436, 120, 8, 330, 'm-steel');
      rc(svg, 540, 120, 8, 330, 'm-steel');
      // Zylinder 1 (Hub)
      rc(svg, 478, 410, 44, 40, 'm-cyl', 3);
      tx(svg, 500, 436, '1', 'm-label light', 'middle');
      const rod1 = rc(svg, 496, Y_LOW + 10, 8, 30, 'm-rod');
      const platform = rc(svg, PX - 4, Y_LOW, PW + 8, 10, 'p2-platform', 2);
      const pkg = parcel(svg);
      // Zylinder 2 (Schieber, von rechts)
      rc(svg, 620, 108, 80, 28, 'm-cyl', 3);
      tx(svg, 660, 127, '2', 'm-label light', 'middle');
      const rod2 = rc(svg, 548, 118, 72, 8, 'm-rod');
      const plate = rc(svg, 540, 104, 10, 40, 'm-jaw');
      const out = Array.from({ length: 4 }, () => parcel(svg));
      // Bedienung
      rc(svg, 14, 220, 190, 116, 'm-panel', 10);
      panelButton(svg, 28, 232, 'S1', 'START', 'm-btn-green', (d) => L.input('start', d), 'Ex.0');
      panelButton(svg, 28, 282, '', 'Paket auflegen', 'm-btn-grey', (d) => L.input('pack', d), '', 160);
      const count = tx(svg, 60, 70, '', 'm-label');
      const valves = [valveSymbol(svg, 20, 432, '1Y1', 'Ax.0'), valveSymbol(svg, 90, 432, '1Y2', 'Ax.1'),
        valveSymbol(svg, 160, 432, '2Y1', 'Ax.2'), valveSymbol(svg, 230, 432, '2Y2', 'Ax.3')];
      const lamps = [lamp(svg, 600, 320, 'S2 Paket', 'Ex.1'), lamp(svg, 600, 410, '1S1 unten', 'Ex.2'), lamp(svg, 600, 240, '1S2 oben', 'Ex.3'),
        lamp(svg, 690, 180, '2S1 ein', 'Ex.4'), lamp(svg, 590, 180, '2S2 aus', 'Ex.5')];
      r = { platform, pkg, rod1, plate, rod2, out, valves, lamps, count };
    },
    render(logic, ax) {
      const L = logic as RollenbahnLogic;
      const py = Y_LOW - (Y_LOW - Y_HIGH) * L.lift.pos;
      r.platform.setAttribute('y', String(py));
      r.rod1.setAttribute('y', String(py + 10));
      r.rod1.setAttribute('height', String(Math.max(0, 410 - py - 10)));
      r.pkg.style.display = L.pkg ? '' : 'none';
      r.pkg.setAttribute('transform', `translate(${PX - PUSH * L.push.pos} ${py - PH})`);
      const px = 540 - PUSH * L.push.pos;
      r.plate.setAttribute('x', String(px - 4));
      r.rod2.setAttribute('x', String(px + 6));
      r.rod2.setAttribute('width', String(620 - px - 6));
      r.out.forEach((g, i) => {
        const p = L.out[i];
        g.style.display = p === undefined ? 'none' : '';
        if (p !== undefined) g.setAttribute('transform', `translate(${340 - p * 280} ${Y_HIGH - PH})`);
      });
      r.count.textContent = `Verpackt: ${L.delivered}`;
      r.valves.forEach((v, i) => v.classList.toggle('on', ((ax >> i) & 1) === 1));
      [1, 2, 3, 4, 5].forEach((b, i) => r.lamps[i]!.classList.toggle('on', ((L.ex >> b) & 1) === 1));
    },
  };
};

export const rollenbahn: ExternalModelDef = {
  id: 'ext-rollenbahn',
  name: 'Verpackungsrollenbahn',
  group: 'Modellpaket 2',
  desc: 'Ein Paket auf dem Hubtisch wird auf Höhe der oberen Rollenbahn gehoben und vom Schieber hinübergeschoben. Der Schieber darf nur bei oben stehendem Hubtisch fahren, der Hubtisch nur bei eingefahrenem Schieber.',
  ax: ['1Y1 Hubtisch heben', '1Y2 Hubtisch senken', '2Y1 Schieber ausfahren', '2Y2 Schieber einfahren', '', '', '', ''],
  ex: ['S1 Taster START', 'S2 Paket auf Hubtisch', '1S1 Hubtisch unten', '1S2 Hubtisch oben', '2S1 Schieber eingefahren', '2S2 Schieber ausgefahren', '', ''],
  width: 720,
  height: 460,
  createLogic: () => new RollenbahnLogic(),
  createView: view,
};
