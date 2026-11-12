import { el } from '../../kit.ts';
import type { ExternalModelDef, ModelView } from '../frame.ts';
import { FoerderLogic } from './foerder.logic.ts';
import { lamp, motorSymbol, panelButton, panelSwitch } from './parts.ts';
import { rect, txt } from './p1.parts.ts';

const BX = [50, 265, 480], BW = 190, BY = 270;
const POOL = 24;

const view = (): ModelView => {
  let items: SVGRectElement[];
  let belts: SVGRectElement[];
  let motors: ReturnType<typeof motorSymbol>[];
  let alarm: SVGCircleElement;
  let offset = 0;
  let last = 0;
  return {
    mount(svg, logic) {
      const L = logic as FoerderLogic;
      rect(svg, 0, 0, 720, 470, 'm-bg');
      el('path', { d: 'M20 14 H150 V100 L105 186 H65 L20 100 Z', class: 'p1-hopper' }, svg);
      rect(svg, 190, 20, 240, 62, 'm-panel', 6);
      txt(svg, 310, 46, 'Modellvariante B', 'm-label', 'middle');
      txt(svg, 310, 66, '(mit Drahtbruchsicherheit)', 'm-label small', 'middle');
      belts = [];
      BX.forEach((x, i) => {
        rect(svg, x, BY, BW, 26, 'p1-belt-top', 13);
        belts.push(rect(svg, x + 14, BY + 8, BW - 28, 10, 'p1-belt-run', 0));
        belts[i]!.setAttribute('class', 'p1-belt-run');
        belts[i]!.setAttribute('fill', 'none');
        el('circle', { cx: x + 13, cy: BY + 13, r: 12, class: 'p1-roll' }, svg);
        el('circle', { cx: x + BW - 13, cy: BY + 13, r: 12, class: 'p1-roll' }, svg);
      });
      items = Array.from({ length: POOL }, () => rect(svg, 0, BY - 12, 16, 12, 'p1-item', 2));
      motors = [];
      const col = [['S1', 'S2'], ['S3', 'S4'], ['S5', 'S6']];
      BX.forEach((x, i) => {
        el('line', { x1: x + 14, y1: BY + 26, x2: x + 14, y2: 350, stroke: '#888', 'stroke-width': 4 }, svg);
        motors.push(motorSymbol(svg, x + 14, 372, `M${i + 1}`, `Ax.${i}`, 22));
        panelButton(svg, x + 56, 392, col[i]![0]!, 'Start', 'm-btn-green', (d) => L.input(`start${i + 1}`, d), '', 64);
        panelButton(svg, x + 126, 392, col[i]![1]!, 'Aus', 'm-btn-red', (d) => L.input(`stop${i + 1}`, d), '', 64);
        txt(svg, x + 88, 446, `${col[i]![0]} · Ex.${i * 2}`, 'm-io', 'middle');
        txt(svg, x + 158, 446, `${col[i]![1]} · Ex.${i * 2 + 1}`, 'm-io', 'middle');
      });
      alarm = lamp(svg, 320, 140, 'H1 ALARM', 'Ax.3', 'red');
      rect(svg, 560, 24, 140, 72, 'm-panel', 12);
      panelSwitch(svg, 574, 40, 'S7', 'NOT-AUS', (on) => L.input('estop', on), 'Ex.6');
    },
    render(logic, ax) {
      const L = logic as FoerderLogic;
      const now = performance.now(), dt = Math.min(0.1, (now - last) / 1000); last = now;
      motors.forEach((m, i) => m.update(L.runs(i), (offset * 40 + i * 30) % 360));
      if (L.runs(0) || L.runs(1) || L.runs(2)) offset += dt;
      belts.forEach((b, i) => { b.style.strokeDashoffset = L.runs(i) ? String(-offset * 40) : '0'; });
      alarm.classList.toggle('on', ((ax >> 3) & 1) === 1);
      items.forEach((r, k) => {
        const it = L.items[k];
        r.style.display = it ? '' : 'none';
        if (!it) return;
        const stack = L.items.slice(0, k).filter((o) => o.belt === it.belt && o.x >= it.x - 0.02 && o.x === it.x).length;
        r.setAttribute('x', String(BX[it.belt]! + 14 + it.x * (BW - 44) - stack * 8));
        r.setAttribute('y', String(BY - 12 - (it.x >= 1 ? stack * 4 : 0)));
      });
    },
  };
};

export const foerder: ExternalModelDef = {
  id: 'ext-foerder',
  name: 'Förderanlage',
  group: 'Modellpaket 1',
  desc: 'Drei Förderbänder transportieren Schüttgut aus einem Trichter. Anlaufen gegen den Materialfluss, Ausschalten mit Verriegelung, NOT-AUS mit Alarm. Variante B: Aus-Taster und NOT-AUS sind Öffner.',
  ax: ['M1 Band 1', 'M2 Band 2', 'M3 Band 3', 'H1 Alarmleuchte', '', '', '', ''],
  ex: ['S1 Start Band 1', 'S2 Aus Band 1 (Öffner)', 'S3 Start Band 2', 'S4 Aus Band 2 (Öffner)', 'S5 Start Band 3', 'S6 Aus Band 3 (Öffner)', 'S7 NOT-AUS (Öffner)', ''],
  width: 720,
  height: 470,
  createLogic: () => new FoerderLogic(),
  createView: view,
};
