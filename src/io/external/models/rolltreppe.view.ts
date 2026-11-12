import { el } from '../../kit.ts';
import type { ExternalModelDef, ModelView } from '../frame.ts';
import { RolltreppeLogic } from './rolltreppe.logic.ts';
import { lamp, panelButton } from './parts.ts';
import { ln, rc, tx } from './p2.parts.ts';
import { blueMotor, faultButton } from './p1.parts.ts';
import { belt, person, sensorBox } from './p3.parts.ts';

const AX = 150, AY = 360, BX = 560, BY = 190;
const LEN = Math.hypot(BX - AX, BY - AY);
const ANG = (Math.atan2(BY - AY, BX - AX) * 180) / Math.PI;

/** Fußpunkt eines Fahrgasts */
function foot(pos: number): [number, number] {
  if (pos < 0.1) return [40 + (pos / 0.1) * (AX - 40), AY - 16];
  if (pos < 0.9) { const t = (pos - 0.1) / 0.8; return [AX + (BX - AX) * t, AY - 16 + (BY - AY) * t]; }
  return [BX + ((pos - 0.9) / 0.1) * 100, BY - 16];
}

const view = (): ModelView => {
  let r: {
    belt: ReturnType<typeof belt>; motor: ReturnType<typeof blueMotor>; people: SVGGElement[]; q1: ReturnType<typeof faultButton>;
    lamps: SVGCircleElement[]; beam: SVGRectElement; counter: SVGTextElement;
  };
  return {
    mount(svg, logic) {
      const L = logic as RolltreppeLogic;
      rc(svg, 0, 0, 720, 460, 'm-bg');
      // Bedienfeld
      rc(svg, 14, 14, 250, 100, 'm-panel', 10);
      panelButton(svg, 28, 22, 'S0', 'EIN', 'm-btn-green', (d) => L.input('s0', d), 'Ex.0');
      panelButton(svg, 28, 66, 'S1', 'AUS', 'm-btn-red', (d) => L.input('s1', d), 'Ex.1');
      const lamps = [lamp(svg, 205, 42, 'H1 Betrieb', 'Ax.1', 'green'), lamp(svg, 205, 92, 'H2 Stop', 'Ax.2', 'red')];
      // Gebäude: Böden
      ln(svg, 0, AY - 16, AX - 13, AY - 16, 'p3-wall');
      ln(svg, BX + 13, BY - 16, 720, BY - 16, 'p3-wall');
      rc(svg, 0, AY - 14, AX - 13, 20, 'p3-floor');
      rc(svg, BX + 13, BY - 14, 720 - BX - 13, 240, 'p3-floor');
      // Treppe (gedreht)
      const g = el('g', { transform: `translate(${AX} ${AY}) rotate(${ANG})` }, svg);
      rc(g, -22, 12, LEN + 44, 24, 'p3-metal', 3);
      const b = belt(g, -13, -13, LEN + 26);
      for (let x = 20; x < LEN; x += 40) ln(g, x, -13, x, 13, 'p3-roller-x');
      el('path', { d: `M-6 -14 V-80 M${LEN + 6} -14 V-80 M-6 -80 H${LEN + 6}`, class: 'p3-wall', 'stroke-width': 3 }, g);
      // Antrieb oben rechts
      const motor = blueMotor(svg, 596, 214, true, 0.9);
      ln(svg, BX, BY, 600, 242, 'p3-metal-dark');
      const q1 = faultButton(svg, 612, 290, 'Motorschutz Q1 auslösen/zurücksetzen', () => L.input('q1', !L.q1));
      tx(svg, 650, 308, 'Q1  Ex.5', 'm-label small');
      tx(svg, 640, 208, 'K1  Ax.0', 'm-label small');
      // STOP-Taster
      panelButton(svg, 20, 360, 'S2', 'STOP', 'm-btn-red', (d) => L.input('s2', d), 'Ex.2');
      panelButton(svg, 560, 70, 'S3', 'STOP', 'm-btn-red', (d) => L.input('s3', d), 'Ex.3');
      // Lichtschranke und Person
      ln(svg, 60, 320, 60, AY - 16, 'p3-tick');
      const beam = sensorBox(svg, 60, 312, 'S4', 'Ex.4');
      panelButton(svg, 20, 410, '', 'Person kommt', 'm-btn-grey', (d) => L.input('person', d), '', 150);
      const people = Array.from({ length: 6 }, () => { const p = el('g', {}, svg); person(p, 1); return p; });
      const counter = tx(svg, 700, 440, '', 'm-label small', 'end');
      r = { belt: b, motor, people, q1, lamps, beam, counter };
    },
    render(logic) {
      const L = logic as RolltreppeLogic;
      r.belt.update(L.travel);
      r.motor.update(L.travel * 6, L.running);
      r.people.forEach((g, i) => {
        const p = L.people[i];
        g.style.display = p ? '' : 'none';
        if (p) { const [x, y] = foot(p.pos); g.setAttribute('transform', `translate(${x} ${y})`); }
      });
      r.q1.set(L.q1);
      r.lamps[0]!.classList.toggle('on', L.h1);
      r.lamps[1]!.classList.toggle('on', L.h2);
      r.beam.classList.toggle('on', L.beam);
      r.counter.textContent = `Oben angekommen: ${L.arrived}`;
    },
  };
};

export const rolltreppe: ExternalModelDef = {
  id: 'ext-rolltreppe',
  name: 'Rolltreppe',
  group: 'Modellpaket 2',
  desc: 'Eine Rolltreppe startet per EIN oder automatisch über die Lichtschranke am Einstieg, mit Nachlaufzeit bis der Fahrgast oben ist. STOP-Taster unten/oben, AUS und Motorschutz Q1 müssen sofort abschalten. Fahrgäste mit „Person kommt". Modellvariante A: Schließer.',
  ax: ['K1 Motor Rolltreppe', 'H1 Meldeleuchte Betrieb', 'H2 Meldeleuchte Stop/Störung', '', '', '', '', ''],
  ex: ['S0 Taster EIN', 'S1 Taster AUS', 'S2 Taster STOP unten', 'S3 Taster STOP oben', 'S4 Lichtschranke Einstieg', 'Q1 Motorschutz ausgelöst', '', ''],
  width: 720,
  height: 460,
  createLogic: () => new RolltreppeLogic(),
  createView: view,
};
