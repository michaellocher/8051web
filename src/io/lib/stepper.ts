/** Schrittmotor mit Schiebeschalter (Handbuch „Sonstige Modelle“). */
import { board, el, rowY, setLit, type DeviceDef } from '../kit.ts';
import { bindLogic, label, pinRows, slideSwitch } from './b1-view.ts';
import { StepperLogic } from './stepper.logic.ts';

export const stepper: DeviceDef = {
  id: 'stepper', name: 'Schrittmotor', group: 'Antriebe', ports: 1, width: 180,
  desc: 'Unipolarer Schrittmotor mit vier Spulen und ein Schiebeschalter. Spulen an D0–D3 (Ausgänge); Schiebeschalter an D7 (Eingang, rechts/rot = 1, kann beliebig verwendet werden). '
    + 'Vollschritt Rechtslauf: D3..D0 = Ah, 6h, 5h, 9h; Linkslauf: Ah, 9h, 5h, 6h. '
    + 'Halbschritt Rechtslauf: Ah, 2h, 6h, 4h, 5h, 1h, 9h, 8h (Linkslauf rückwärts). Bei undefinierten Zuständen zeigt das Modell ein Fragezeichen im Rotor.',
  create(onInput) {
    const logic = new StepperLogic();
    const svg = board(180, 1);
    pinRows(svg, [[0, 'D0'], [1, 'D1'], [2, 'D2'], [3, 'D3'], [7, 'D7', true]], 40);
    const cx = 110, cy = 76, k = 0.66;
    // Ständer und Rotor in einer Gruppe um (0,0), Maßstab k. Spulen im Uhrzeigersinn: D3 oben, D1 rechts, D2 unten, D0 links.
    const g = el('g', { transform: `translate(${cx} ${cy}) scale(${k})` }, svg);
    el('path', { d: 'M-40 -92 H40 V-66 H16 V-50 H-16 V-66 H-40 Z', class: 'dm-yoke' }, g);
    el('path', { d: 'M-40 92 H40 V66 H16 V50 H-16 V66 H-40 Z', class: 'dm-yoke' }, g);
    el('path', { d: 'M-92 -40 V40 H-66 V16 H-50 V-16 H-66 V-40 Z', class: 'dm-yoke' }, g);
    el('path', { d: 'M92 -40 V40 H66 V16 H50 V-16 H66 V-40 Z', class: 'dm-yoke' }, g);
    const coilAt: [number, number][] = [[-78, 0], [78, 0], [0, 78], [0, -78]]; // D0 links, D1 rechts, D2 unten, D3 oben
    const coils = coilAt.map(([x, y]) => el('circle', { cx: x, cy: y, r: 7, class: 'dev-led green' }, g));
    const tagAt: [number, number][] = [[-78, -14], [78, -14], [0, 106], [0, -98]];
    tagAt.forEach(([x, y], i) => label(g, x, y, `D${i}`, 'dev-tiny', 'middle'));
    const rotor = el('g', {}, g);
    el('circle', { cx: 0, cy: 0, r: 40, class: 'dm-rotor-rim' }, rotor);
    el('path', { d: 'M0 0 L-28 -28 A40 40 0 0 1 28 -28 Z', class: 'dm-rotor-n' }, rotor);
    el('path', { d: 'M0 0 L-28 28 A40 40 0 0 0 28 28 Z', class: 'dm-rotor-s' }, rotor);
    el('path', { d: 'M0 0 L-28 -28 A40 40 0 0 0 -28 28 Z', class: 'dm-rotor-w' }, rotor);
    el('path', { d: 'M0 0 L28 -28 A40 40 0 0 1 28 28 Z', class: 'dm-rotor-w' }, rotor);
    const q = el('text', { x: 0, y: 14, class: 'dm-rotor-q', 'text-anchor': 'middle' }, g);
    const info = label(svg, 176, 157, '', 'dev-tiny', 'end');
    const upd = slideSwitch(svg, 46, rowY(7) - 8, () => logic.slider, (v) => { logic.slider = v; onInput(); }, 36, 16);
    return {
      ...bindLogic(svg, logic, () => {
        coils.forEach((c, i) => setLit(c, (logic.coils >> i) & 1));
        rotor.setAttribute('transform', `rotate(${logic.angle})`);
        q.textContent = logic.undefinedState ? '?' : '';
        info.textContent = logic.undefinedState ? 'undefinierter Zustand' : `Halbschritte: ${logic.net}`;
        upd();
      }),
      drive: () => logic.drive(),
    };
  },
};
