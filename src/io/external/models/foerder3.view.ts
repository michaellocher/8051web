import { el } from '../../kit.ts';
import type { ExternalModelDef, ModelView } from '../frame.ts';
import { Foerder3Logic } from './foerder3.logic.ts';
import { lamp, panelButton, panelSwitch } from './parts.ts';
import { ln, rc, tx } from './p2.parts.ts';
import { blueMotor } from './p1.parts.ts';
import { msgBox, sensorBox, warnTriangle } from './p3.parts.ts';

const X0 = 190, X1 = 560, WAGON_W = 110, WY = 232;
let uid = 0;

const view = (): ModelView => {
  let r: {
    wagon: SVGGElement; wfill: SVGRectElement; rope: SVGLineElement; motor: ReturnType<typeof blueMotor>; s: SVGRectElement[];
    k: SVGCircleElement[]; fillStream: SVGLineElement; dropStream: SVGLineElement; bin: SVGRectElement; msgs: ReturnType<typeof msgBox>;
    wheels: SVGGElement[];
  };
  return {
    mount(svg, logic) {
      const L = logic as Foerder3Logic;
      const id = `p3-f3-clip-${++uid}`;
      rc(svg, 0, 0, 720, 460, 'm-bg');
      rc(svg, 14, 14, 160, 60, 'm-panel', 10);
      panelSwitch(svg, 26, 22, 'S0', 'Start', (on) => L.input('s0', on), 'Ex.0');
      // Trichter rechts
      el('path', { d: `M${X1 + 10} 40 H${X1 + 110} L${X1 + 70} 130 H${X1 + 50} Z`, class: 'p3-glass' }, svg);
      el('path', { d: `M${X1 + 14} 56 H${X1 + 106} L${X1 + 69} 130 H${X1 + 51} Z`, class: 'p3-grain-lt' }, svg);
      rc(svg, X1 + 50, 130, 20, 20, 'p3-metal-dark');
      tx(svg, X1 + 60, 30, 'Trichter', 'm-label small', 'middle');
      const fillStream = el('line', { x1: X1 + 60, y1: 150, x2: X1 + 60, y2: WY + 30, class: 'p3-stream grain' }, svg);
      // Schiene, Seil und Antrieb
      rc(svg, 90, 296, 620, 8, 'p3-metal-dark');
      for (let x = 100; x < 710; x += 36) rc(svg, x, 304, 14, 6, 'p3-metal-dark');
      const motor = blueMotor(svg, 14, 244, false, 0.7);
      const rope = el('line', { x1: 82, y1: 266, x2: X0 - 20, y2: 266, stroke: '#333', 'stroke-width': 3 }, svg);
      // Entladebehälter links
      rc(svg, X0 - 60, 330, 120, 56, 'p3-glass');
      const bin = rc(svg, X0 - 58, 384, 116, 0, 'p3-grain-lt');
      tx(svg, X0, 402, 'Entladung', 'm-io', 'middle');
      const dropStream = el('line', { x1: X0, y1: WY + 56, x2: X0, y2: 384, class: 'p3-stream grain' }, svg);
      // Wagon
      const wagon = el('g', { transform: `translate(${X0} 0)` }, svg);
      rc(wagon, -WAGON_W / 2, WY, WAGON_W, 50, 'p3-wagon-body', 4);
      el('clipPath', { id }, svg).append(el('rect', { x: -WAGON_W / 2 + 4, y: WY + 4, width: WAGON_W - 8, height: 42 }));
      const wg = el('g', { 'clip-path': `url(#${id})` }, wagon);
      const wfill = rc(wg, -WAGON_W / 2 + 4, WY + 46, WAGON_W - 8, 0, 'p3-grain-lt');
      const wheels = [-WAGON_W / 2 + 22, WAGON_W / 2 - 22].map((x) => {
        const g = el('g', { transform: `translate(${x} ${WY + 52})` }, wagon);
        el('circle', { cx: 0, cy: 0, r: 13, class: 'p3-roller' }, g);
        const sp = el('g', {}, g);
        el('line', { x1: -9, y1: 0, x2: 9, y2: 0, class: 'p3-roller-x' }, sp);
        return sp;
      });
      // Endschalter
      
      const s = [sensorBox(svg, X0 - 72, 322, 'S1 links', 'Ex.1', 'left'), sensorBox(svg, X1 + 60, 330, 'S2 rechts', 'Ex.2')];
      ln(svg, X0 - 72, 316, X0 - 72, 300, 'p3-tick'); ln(svg, X1 + 60, 324, X1 + 60, 300, 'p3-tick');
      // Motorschütze
      const k = [lamp(svg, 34, 376, 'K1 →', 'Ax.0'), lamp(svg, 84, 376, 'K2 ←', 'Ax.1')];
      // Fehlerliste
      warnTriangle(svg, 296, 420, 1);
      const msgs = msgBox(svg, 330, 372, 380, 76, '');
      tx(svg, 330, 366, 'Fehlermeldungen', 'm-label small');
      panelButton(svg, 20, 100, '', 'Meldungen löschen', 'm-btn-grey', (d) => L.input('clear', d), '', 150);
      r = { wagon, wfill, rope, motor, s, k, fillStream, dropStream, bin, msgs, wheels };
    },
    render(logic) {
      const L = logic as Foerder3Logic;
      const x = X0 + L.pos * (X1 + 60 - X0);
      r.wagon.setAttribute('transform', `translate(${x} 0)`);
      r.wfill.setAttribute('y', String(WY + 46 - L.load * 42)); r.wfill.setAttribute('height', String(L.load * 42));
      r.rope.setAttribute('x2', String(x - WAGON_W / 2 + 2));
      r.motor.update(L.pos * 3600, L.dir !== 0);
      r.wheels.forEach((w) => w.setAttribute('transform', `rotate(${L.pos * 2600})`));
      r.fillStream.style.display = L.filling && L.load < 1 ? '' : 'none';
      r.dropStream.style.display = L.unloading ? '' : 'none';
      const ex = L.ex;
      r.s[0]!.classList.toggle('on', ((ex >> 1) & 1) === 1);
      r.s[1]!.classList.toggle('on', ((ex >> 2) & 1) === 1);
      r.k[0]!.classList.toggle('on', L.k1);
      r.k[1]!.classList.toggle('on', L.k2);
      r.msgs.set(L.errors);
      const bh = Math.min(50, L.cycles * 12);
      r.bin.setAttribute('y', String(384 - bh)); r.bin.setAttribute('height', String(bh));
    },
  };
};

export const foerder3: ExternalModelDef = {
  id: 'ext-foerder3',
  name: 'Förderanlage III',
  group: 'Modellpaket 2',
  desc: 'Ein Wagen pendelt zwischen Entladepunkt (links, S1) und Trichter (rechts, S2). Beladen dauert 5 s, Entleeren 3 s: Wartezeiten einhalten, Endschalter beachten, Fehlerliste im Modellfenster. Modellvariante A: Schließer.',
  ax: ['K1 Motor Rechtslauf (→)', 'K2 Motor Linkslauf (←)', '', '', '', '', '', ''],
  ex: ['S0 Schalter Start', 'S1 Endschalter links', 'S2 Endschalter rechts', '', '', '', '', ''],
  width: 720,
  height: 460,
  createLogic: () => new Foerder3Logic(),
  createView: view,
};
