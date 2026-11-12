import { el } from '../../kit.ts';
import type { ExternalModelDef, ModelView } from '../frame.ts';
import { MfsLogic } from './mfs.logic.ts';
import { label } from './parts.ts';
import { blueMotor, rect, txt } from './p1.parts.ts';

const view = (): ModelView => {
  let rockers: SVGGElement[];
  let motor: ReturnType<typeof blueMotor>;
  let arrow: SVGGElement;
  return {
    mount(svg, logic) {
      const L = logic as MfsLogic;
      rect(svg, 0, 0, 720, 360, 'm-bg');
      rect(svg, 190, 20, 340, 150, 'm-panel', 14);
      rockers = [0, 1, 2, 3].map((i) => {
        const g = el('g', { class: 'p1-rocker', transform: `translate(${222 + i * 74} 38)`, tabindex: 0, role: 'switch', 'aria-label': `S${i + 1}` }, svg);
        rect(g, 0, 0, 46, 84, 'p1-rocker-body', 6);
        rect(g, 5, 5, 36, 36, 'p1-rocker-half p1-rocker-up', 3);
        rect(g, 5, 43, 36, 36, 'p1-rocker-half p1-rocker-dn', 3);
        txt(g, 23, 108, `S${i + 1}`, 'm-label', 'middle');
        txt(g, 23, 122, `Ex.${i}`, 'm-io', 'middle');
        const flip = () => L.input(`s${i + 1}`, !L.sw[i]);
        g.addEventListener('click', flip);
        g.addEventListener('keydown', (e) => { if (e.key === ' ' || e.key === 'Enter') { e.preventDefault(); flip(); } });
        return g;
      });
      motor = blueMotor(svg, 300, 230, false, 1.5);
      label(svg, 250, 262, 'M1', 'm-label', 'end');
      label(svg, 250, 280, 'Ax.0', 'm-io', 'end');
      arrow = el('g', { transform: 'translate(480 262)' }, svg);
      el('path', { d: 'M0 -14 A14 14 0 1 1 -10 -10', fill: 'none', stroke: '#333', 'stroke-width': 2 }, arrow);
      el('path', { d: 'M-16 -8 L-8 -12 L-9 -3 Z', fill: '#333' }, arrow);
      label(svg, 360, 340, 'Jede Betätigung eines Schalters ändert den Zustand von M1 (Wechsel-/Kreuzschaltung).', 'm-label small', 'middle');
    },
    render(logic) {
      const L = logic as MfsLogic;
      rockers.forEach((g, i) => g.classList.toggle('up', L.sw[i]!));
      motor.update(L.motor.angle, L.motor.running);
      arrow.style.opacity = L.motor.running ? '1' : '.25';
    },
  };
};

export const mfs: ExternalModelDef = {
  id: 'ext-mfs',
  name: 'Mehrfachschaltstellen',
  group: 'Modellpaket 1',
  desc: 'Ein Motor wird von vier Schaltstellen aus bedient: Jede Betätigung eines der vier Schalter soll den Motor ein- bzw. ausschalten (Wechsel- und Kreuzschaltung).',
  ax: ['M1 Motor', '', '', '', '', '', '', ''],
  ex: ['S1 Schalter (Wippe)', 'S2 Schalter (Wippe)', 'S3 Schalter (Wippe)', 'S4 Schalter (Wippe)', '', '', '', ''],
  width: 720,
  height: 360,
  createLogic: () => new MfsLogic(),
  createView: view,
};
