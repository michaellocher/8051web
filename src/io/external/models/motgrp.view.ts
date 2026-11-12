import { el } from '../../kit.ts';
import type { ExternalModelDef, ModelView } from '../frame.ts';
import { MOTGRP_NAMES, MotgrpLogic } from './motgrp.logic.ts';
import { label, lamp, panelButton } from './parts.ts';
import { blueMotor, faultButton, nBox, rect } from './p1.parts.ts';

const view = (): ModelView => {
  let motors: ReturnType<typeof blueMotor>[];
  let sensors: ReturnType<typeof nBox>[];
  let faults: ReturnType<typeof faultButton>[];
  let lamps: SVGCircleElement[];
  return {
    mount(svg, logic) {
      const L = logic as MotgrpLogic;
      rect(svg, 0, 0, 720, 470, 'm-bg');
      rect(svg, 150, 14, 420, 72, 'm-panel', 14);
      lamps = [lamp(svg, 190, 56, 'H1', 'Ax.0', 'red'), lamp(svg, 530, 56, 'H2', 'Ax.1', 'red')];
      label(svg, 360, 38, 'Störung', 'm-label', 'middle');
      panelButton(svg, 280, 44, 'S0', 'Quit', 'm-btn-yellow', (d) => L.input('quit', d), 'Ex.6');
      motors = []; sensors = []; faults = [];
      for (const g of [0, 1]) {
        const ox = g * 360;
        rect(svg, ox + 224, 106, 130, 306, 'p1-teal', 4);
        label(svg, ox + 289, 432, 'Drehzahlwächter', 'm-label', 'middle');
        label(svg, ox + 289, 450, `Gruppe ${g + 1}`, 'm-io', 'middle');
        for (let r = 0; r < 3; r++) {
          const i = g * 3 + r, y = 116 + r * 100;
          faults.push(faultButton(svg, ox + 20, y + 14, `Störung ${MOTGRP_NAMES[i]} ein/aus`, () => L.input(`f${i}`, true)));
          motors.push(blueMotor(svg, ox + 60, y));
          el('rect', { x: ox + 156, y: y + 24, width: 78, height: 6, class: 'p1-shaft' }, svg);
          sensors.push(nBox(svg, ox + 234, y + 14));
          label(svg, ox + 278, y + 26, MOTGRP_NAMES[i]!, 'm-label small');
          label(svg, ox + 278, y + 40, `Ex.${i}`, 'm-io');
        }
      }
    },
    render(logic, ax) {
      const L = logic as MotgrpLogic;
      L.motors.forEach((m, i) => { motors[i]!.update(m.angle, m.speed > 0.05); sensors[i]!.set(m.running); faults[i]!.set(L.failed[i]!); });
      lamps.forEach((l, i) => l.classList.toggle('on', ((ax >> i) & 1) === 1));
    },
  };
};

export const motgrp: ExternalModelDef = {
  id: 'ext-motgrp',
  name: 'Motorgruppenüberwachung',
  group: 'Modellpaket 1',
  desc: 'Zwei Gruppen mit je drei Motoren und Drehzahlwächtern. Fällt ein Motor aus (Blitzsymbol anklicken), soll die Gruppenstörlampe leuchten, bis die Störung behoben und mit S0 quittiert ist.',
  ax: ['H1 Störung Gruppe 1', 'H2 Störung Gruppe 2', '', '', '', '', '', ''],
  ex: ['M_A1 dreht', 'M_B1 dreht', 'M_C1 dreht', 'M_A2 dreht', 'M_B2 dreht', 'M_C2 dreht', 'S0 Taster Quittieren', ''],
  width: 720,
  height: 470,
  createLogic: () => new MotgrpLogic(),
  createView: view,
};
