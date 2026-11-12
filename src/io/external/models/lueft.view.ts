import { el } from '../../kit.ts';
import type { ExternalModelDef, ModelView } from '../frame.ts';
import { LueftLogic } from './lueft.logic.ts';
import { label, lamp } from './parts.ts';
import { faultButton, fan, rect } from './p1.parts.ts';

const FANS = [
  { x: 262, y: 96, bx: 214, by: 70, bh: 200 }, { x: 664, y: 96, bx: 622, by: 80, bh: 220 },
  { x: 140, y: 214, bx: 100, by: 190, bh: 230 }, { x: 556, y: 214, bx: 516, by: 190, bh: 230 },
];

const view = (): ModelView => {
  let fans: ReturnType<typeof fan>[];
  let sens: SVGCircleElement[];
  let faults: ReturnType<typeof faultButton>[];
  let lamps: SVGCircleElement[];
  return {
    mount(svg, logic) {
      const L = logic as LueftLogic;
      rect(svg, 0, 0, 720, 460, 'm-bg');
      // Tunnelfahrbahn in Perspektive
      el('polygon', { points: '20,440 250,160 560,160 700,440', class: 'p1-road' }, svg);
      el('line', { x1: 140, y1: 440, x2: 330, y2: 160, class: 'p1-road-line' }, svg);
      el('line', { x1: 560, y1: 440, x2: 470, y2: 160, class: 'p1-road-line' }, svg);
      el('line', { x1: 300, y1: 410, x2: 470, y2: 410, class: 'p1-road-line' }, svg);
      fans = []; sens = []; faults = [];
      FANS.forEach((f, i) => {
        rect(svg, f.bx, f.by + 40, 44, f.bh - 40, 'p1-pillar');
        rect(svg, f.bx + 44, f.by + 46, 12, f.bh - 46, 'p1-pillar-side');
        fans.push(fan(svg, f.x - 18, f.y + 40, 28));
        sens.push(lamp(svg, f.x + 22, f.y + 82, `S${i + 1}`, `Ex.${i}`));
        faults.push(faultButton(svg, f.bx + 6, f.by + 100, `Lüfter ${i + 1} Störung ein/aus`, () => L.input(`f${i + 1}`, true)));
      });
      // Ampel A1
      const px = 380, py = 250;
      rect(svg, px, py, 56, 140, 'p1-light-box', 6);
      lamps = [lamp(svg, px + 28, py + 28, '', '', 'red'), lamp(svg, px + 28, py + 70, '', '', 'yellow'), lamp(svg, px + 28, py + 112, '', '', 'green')];
      ['Ax.0', 'Ax.1', 'Ax.2'].forEach((t, i) => label(svg, px - 8, py + 32 + i * 42, t, 'm-label small', 'end'));
      label(svg, px + 28, py + 158, 'A1', 'm-label', 'middle');
      label(svg, 360, 28, 'Lüftungsüberwachung Tunnel', 'm-label', 'middle');
      label(svg, 360, 46, 'Blitz: Lüfter ausfallen lassen', 'm-io', 'middle');
    },
    render(logic, ax) {
      const L = logic as LueftLogic;
      L.fans.forEach((f, i) => { fans[i]!.update(f.angle, f.speed > 0.05, L.failed[i]); sens[i]!.classList.toggle('on', f.running); faults[i]!.set(L.failed[i]!); });
      lamps.forEach((l, i) => l.classList.toggle('on', ((ax >> i) & 1) === 1));
    },
  };
};

export const lueft: ExternalModelDef = {
  id: 'ext-lueft',
  name: 'Lüftungsüberwachung',
  group: 'Modellpaket 1',
  desc: 'Vier Tunnellüfter mit Drehzahlwächtern. Die Ampel A1 am Portal soll bei mindestens drei laufenden Lüftern grün, bei zwei gelb und bei höchstens einem rot zeigen.',
  ax: ['A1 Ampel rot', 'A1 Ampel gelb', 'A1 Ampel grün', '', '', '', '', ''],
  ex: ['S1 Drehzahlwächter Lüfter 1', 'S2 Drehzahlwächter Lüfter 2', 'S3 Drehzahlwächter Lüfter 3', 'S4 Drehzahlwächter Lüfter 4', '', '', '', ''],
  width: 720,
  height: 460,
  createLogic: () => new LueftLogic(),
  createView: view,
};
