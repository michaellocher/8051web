import { el } from '../../kit.ts';
import type { ExternalModelDef, ModelView } from '../frame.ts';
import { SpielLogic } from './spiel.logic.ts';
import { label, lamp, panelButton, panelSwitch } from './parts.ts';
import { bowtie, fan, frame, rect } from './p1.parts.ts';

const view = (): ModelView => {
  let lamps: SVGCircleElement[];
  let fans: ReturnType<typeof fan>[];
  let valves: ReturnType<typeof bowtie>[];
  return {
    mount(svg, logic) {
      const L = logic as SpielLogic;
      rect(svg, 0, 0, 720, 460, 'm-bg');
      frame(svg, 20, 14, 330, 156, 'Schalter');
      frame(svg, 370, 14, 330, 156, 'Taster');
      for (let i = 0; i < 4; i++) {
        const x = 40 + (i % 2) * 150, y = 52 + Math.floor(i / 2) * 55;
        panelSwitch(svg, x, y, `S0${i + 1}`, `Schalter ${i + 1}`, (on) => L.input(`s${i + 1}`, on), `Ex.${i}`);
        panelButton(svg, 390 + (i % 2) * 150, y, `T0${i + 1}`, `Taster ${i + 1}`, 'm-btn-yellow', (d) => L.input(`t${i + 1}`, d), `Ex.${i + 4}`);
      }
      frame(svg, 20, 184, 680, 96, 'Anzeigen');
      lamps = [0, 1, 2, 3].map((i) => lamp(svg, 110 + i * 165, 238, `H0${i + 1}`, `Ax.${i}`, 'yellow'));
      frame(svg, 20, 294, 680, 154, 'Aktoren');
      fans = [0, 1].map((i) => {
        const cx = 90 + i * 110;
        const f = fan(svg, cx, 366, 28);
        label(svg, cx, 412, `M0${i + 1}`, 'm-label', 'middle');
        label(svg, cx, 430, `Ax.${4 + i}`, 'm-io', 'middle');
        return f;
      });
      valves = [0, 1].map((i) => {
        const cx = 400 + i * 170;
        const v = bowtie(svg, cx, 366, 40);
        label(svg, cx, 336, `V0${i + 1}`, 'm-label', 'middle');
        label(svg, cx, 412, `Ax.${6 + i}`, 'm-io', 'middle');
        return v;
      });
      el('text', { x: 690, y: 440, class: 'm-io', 'text-anchor': 'end' }, svg).textContent = '';
    },
    render(logic) {
      const L = logic as SpielLogic;
      lamps.forEach((l, i) => l.classList.toggle('on', L.lamp(i)));
      fans.forEach((f, i) => f.update(L.motors[i]!.angle, L.motors[i]!.running));
      valves.forEach((v, i) => v.set(L.valves[i]! > 0.5));
    },
  };
};

export const spiel: ExternalModelDef = {
  id: 'ext-spiel',
  name: 'Spielwiese',
  group: 'Modellpaket 1',
  desc: 'Freies Experimentierfeld: vier Schalter und vier Taster als Eingänge, vier Lampen, zwei Motoren und zwei Ventile als Ausgänge.',
  ax: ['H01 Lampe', 'H02 Lampe', 'H03 Lampe', 'H04 Lampe', 'M01 Motor', 'M02 Motor', 'V01 Ventil', 'V02 Ventil'],
  ex: ['S01 Schalter', 'S02 Schalter', 'S03 Schalter', 'S04 Schalter', 'T01 Taster', 'T02 Taster', 'T03 Taster', 'T04 Taster'],
  width: 720,
  height: 460,
  createLogic: () => new SpielLogic(),
  createView: view,
};
