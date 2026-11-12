/** Behälter mit Zulauf- und Ablassventil und drei Füllstandssensoren. */
import { board, el, led, setLit, type DeviceDef } from '../kit.ts';
import { bindLogic, label, pinRows, pipe, valve } from './b1-view.ts';
import { TankLogic } from './tank.logic.ts';

export const behaelter: DeviceDef = {
  id: 'behaelter', name: 'Behälter', group: 'Prozesse', ports: 1, width: 230,
  desc: 'Apparatur mit einem Zulauf- und einem Ablassventil. D0 = Ventil-1 zum Füllen des Messgefäßes (1 = offen), D1 = Ventil-2 zum Leeren (1 = offen) (Ausgänge). '
    + 'D2 = Füllstandsensor-A (unten), D3 = Füllstandsensor-B (Mitte), D4 = Füllstandsensor-C (oben) (Eingänge, 1 = Flüssigkeit am Sensor). '
    + 'Beide Ventile fördern je 10 l/s, der Behälter fasst 100 l (A bei 15 l, B bei 50 l, C bei 85 l).',
  create() {
    const logic = new TankLogic();
    const svg = board(230, 1);
    pinRows(svg, [[0, 'D0'], [1, 'D1'], [2, 'D2', true], [3, 'D3', true], [4, 'D4', true]], 40);
    el('rect', { x: 46, y: 4, width: 180, height: 152, rx: 4, class: 'dm-sunny' }, svg);
    const tx = 100, tw = 70, ty = 40, th = 90;
    el('rect', { x: tx, y: ty, width: tw, height: th, class: 'b1-tank-bg' }, svg);
    const water = el('rect', { x: tx, y: ty + th, width: tw, height: 0, class: 'b1-water' }, svg);
    el('rect', { x: tx, y: ty, width: tw, height: th, class: 'b1-tank' }, svg);
    const marks = (['A', 'B', 'C'] as const).map((k) => {
      const y = ty + th - (logic.thresholds[k] / logic.capacity) * th;
      el('circle', { cx: tx + tw - 8, cy: y, r: 3, class: 'dm-dot' }, svg);
      el('line', { x1: tx + tw - 5, y1: y, x2: tx + tw + 14, y2: y, class: 'dev-wire' }, svg);
      const l = led(svg, tx + tw + 20, y, 6, 'red');
      label(svg, tx + tw + 30, y + 4, k, 'dm-tag-big');
      return l;
    });
    // Zulauf (links oben) und Entlüftung, Ablauf unten
    const inFlow = pipe(svg, `M50 26 H${tx + 14} V${ty}`);
    const outFlow = pipe(svg, `M${tx + 35} ${ty + th} V150`);
    const v1 = valve(svg, 76, 26, 'V1');
    const v2 = valve(svg, tx + 35, 142, 'V2');
    label(svg, 62, 46, 'D0', 'dm-red-tag');
    label(svg, tx + 44, 146, 'D1', 'dm-red-tag');
    el('path', { d: `M${tx + 50} ${ty} V${ty - 14} M${tx + 44} ${ty - 8} L${tx + 50} ${ty - 14} L${tx + 56} ${ty - 8}`, class: 'dm-vent' }, svg);
    return bindLogic(svg, logic, () => {
      const h = (logic.level / logic.capacity) * th;
      water.setAttribute('y', String(ty + th - h)); water.setAttribute('height', String(h));
      (['A', 'B', 'C'] as const).forEach((k, i) => setLit(marks[i]!, logic.sensor(k) ? 1 : 0));
      v1(logic.v1); v2(logic.v2);
      inFlow(logic.v1); outFlow(logic.v2 && logic.level > 0);
    });
  },
};
