import { el } from '../../kit.ts';
import type { ExternalModelDef, ModelView } from '../frame.ts';
import { ReaktionLogic } from './reaktion.logic.ts';
import { lamp, panelButton, panelSwitch } from './parts.ts';
import { digit, rc, tx } from './p2.parts.ts';

const view = (): ModelView => {
  let r: { lamps: SVGCircleElement[]; digits: ((n: number) => void)[]; car: SVGGElement; result: SVGTextElement; flash: SVGRectElement; stats: SVGTextElement };
  return {
    mount(svg, logic) {
      const L = logic as ReaktionLogic;
      rc(svg, 0, 0, 720, 460, 'm-bg');
      // Anzeigetafel
      rc(svg, 20, 16, 680, 150, 'm-panel', 16);
      const l1 = lamp(svg, 54, 56, '', '', 'yellow');
      const l2 = lamp(svg, 54, 112, '', '', 'red');
      tx(svg, 74, 52, 'Achtung – Zeit läuft!', 'm-label');
      tx(svg, 74, 66, 'P1 · Ax.0', 'm-io');
      tx(svg, 74, 108, 'Bremsen!', 'm-label');
      tx(svg, 74, 122, 'P2 · Ax.1', 'm-io');
      // Zeitanzeige
      rc(svg, 330, 30, 350, 120, 'p4-display', 10);
      const digits = [0, 1, 2, 3].map((i) => digit(svg, 372 + i * 52, 74, 34, 56));
      tx(svg, 590, 126, 'ms', 'p4-display-unit');
      tx(svg, 350, 52, 'Reaktionszeit', 'p4-display-cap');
      // Straße mit Auto und Hindernis
      rc(svg, 20, 186, 680, 96, 'p4-road', 4);
      for (let x = 40; x < 680; x += 60) rc(svg, x, 232, 30, 4, 'p4-lane');
      const flash = rc(svg, 20, 186, 680, 96, 'p4-flash', 4);
      const barrier = el('g', { transform: 'translate(640 196)' }, svg);
      rc(barrier, 0, 0, 14, 76, 'p4-barrier', 2);
      rc(barrier, 0, 12, 14, 12, 'p4-barrier-stripe'); rc(barrier, 0, 40, 14, 12, 'p4-barrier-stripe');
      const car = el('g', { transform: 'translate(50 208)' }, svg);
      rc(car, 0, 12, 92, 30, 'p4-car', 6);
      rc(car, 22, 0, 48, 20, 'p4-car-top', 5);
      rc(car, 28, 4, 16, 12, 'p4-glass'); rc(car, 48, 4, 16, 12, 'p4-glass');
      el('circle', { cx: 20, cy: 44, r: 8, class: 'p4-wheel' }, car);
      el('circle', { cx: 72, cy: 44, r: 8, class: 'p4-wheel' }, car);
      const result = tx(svg, 360, 306, '', 'p4-result', 'middle');
      // Bedienelemente
      rc(svg, 20, 322, 680, 120, 'm-panel', 12);
      panelButton(svg, 36, 340, 'S0', 'Reset', 'm-btn-yellow', (d) => L.input('s0', d), 'Ex.0');
      panelButton(svg, 196, 340, 'S1', 'Zeit-Freigabe', 'm-btn-green', (d) => L.input('s1', d), 'Ex.1');
      panelButton(svg, 376, 340, 'S2', 'Bremspedal', 'm-btn-red', (d) => L.input('s2', d), 'Ex.2');
      panelSwitch(svg, 556, 340, 'S3', 'Schwer', (on) => L.input('hard', on), 'Ex.3');
      tx(svg, 36, 410, 'Schalter links: leicht (1,0 s), rechts: schwer (0,6 s)', 'm-io');
      const stats = tx(svg, 684, 432, '', 'm-io', 'end');
      r = { lamps: [l1, l2], digits, car, result, flash, stats };
    },
    render(logic) {
      const L = logic as ReaktionLogic;
      r.lamps[0]!.classList.toggle('on', L.p1);
      r.lamps[1]!.classList.toggle('on', L.p2);
      const ms = L.reactionMs;
      const txt = ms === null ? '' : String(Math.min(9999, ms)).padStart(4, ' ');
      r.digits.forEach((d, i) => d(ms === null ? -1 : txt[i] === ' ' ? -1 : Number(txt[i])));
      r.car.setAttribute('transform', `translate(${50 + L.approach * 480} 208)`);
      r.flash.classList.toggle('on', L.result === 'crash');
      r.result.textContent = L.status;
      r.stats.textContent = `Tests: ${L.tests} · Fehlstarts: ${L.falseStarts} · Aufpralle: ${L.crashes}`;
    },
  };
};

export const reaktion: ExternalModelDef = {
  id: 'ext-reaktion',
  name: 'Reaktionstest',
  group: 'Modellpaket 2',
  desc: 'Reaktionstester: Nach der Zeit-Freigabe soll das Programm nach einer Zufallszeit „Bremsen!“ anzeigen und die Zeit bis zum Tritt aufs Bremspedal messen (Timer 0). Fehlstarts und zu späte Reaktion werden erkannt.',
  ax: ['P1 Lampe „Achtung – Zeit läuft!“', 'P2 Lampe „Bremsen!“', '', '', '', '', '', ''],
  ex: ['S0 Taster Reset', 'S1 Taster Zeit-Freigabe', 'S2 Bremspedal', 'S3 Schwierigkeitsgrad (1 = schwer)', '', '', '', ''],
  width: 720,
  height: 460,
  createLogic: () => new ReaktionLogic(),
  createView: view,
};
