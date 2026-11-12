/** Prozess: Mischen zweier Flüssigkeiten; Ansteuerung über Demultiplexer, Sensoren über Multiplexer. */
import { board, el, setLit, led, type DeviceDef } from '../kit.ts';
import { bindLogic, label, pinRows, pipe, valve } from './b1-view.ts';
import { ProzessLogic, SENSOR_NAMES } from './prozess.logic.ts';

export const prozess: DeviceDef = {
  id: 'prozess', name: 'Prozess', group: 'Prozesse', ports: 1, width: 300,
  desc: 'Anlage zum Mischen von 2 Flüssigkeiten. Die Ventile und der Rührmotor werden über einen Demultiplexer DX gesteuert, die Füllstandsensoren über einen Multiplexer MUX abgefragt. '
    + 'D0–D2 = Adresse des Demultiplexers, D3 = EN (Freigabe, 1 = der adressierte Ausgang ist High); D4–D6 = Adresse des Multiplexers, D7 = Multiplexer-Ausgang (Eingang, 1 = Sensor des adressierten Eingangs ist nass). '
    + 'Ausgänge des Demultiplexers: 0 = Ventil 0 (Zulauf links), 1 = Ventil 1 (Zulauf rechts), 2 = Ventil 2 (links → Mischbehälter), 3 = Ventil 3 (rechts → Mischbehälter), 4 = Rührmotor, 5 = Ventil 5 (Ablauf); 6 und 7 unbelegt. '
    + 'Eingänge des Multiplexers: 0 = A, 1 = B (Behälter links unten/oben), 2 = C, 3 = D (Behälter rechts), 4 = E, 5 = F (Mischbehälter); 6 und 7 unbelegt (0). '
    + 'Es ist immer nur ein Demultiplexer-Ausgang aktiv; für mehrere gleichzeitige Aktoren muss das Programm die Ausgänge im Wechsel ansteuern (Ventile und Motor haben 20 ms Trägheit).',
  create() {
    const logic = new ProzessLogic();
    const svg = board(300, 1);
    pinRows(svg, [[0, 'D0'], [1, 'D1'], [2, 'D2'], [3, 'D3 EN'], [4, 'D4'], [5, 'D5'], [6, 'D6'], [7, 'D7', true]], 40);
    // Bausteine DX und MUX
    el('rect', { x: 44, y: 4, width: 64, height: 66, class: 'dev-chip' }, svg);
    label(svg, 76, 16, 'DX', 'dm-chip-txt', 'middle');
    label(svg, 48, 50, 'EN', 'dm-chip-txt');
    el('rect', { x: 44, y: 80, width: 64, height: 76, class: 'dev-chip' }, svg);
    label(svg, 76, 92, 'MUX', 'dm-chip-txt', 'middle');
    // Anlage
    el('rect', { x: 112, y: 4, width: 184, height: 152, rx: 4, class: 'dm-process' }, svg);
    const cap = 100;
    const tank = (x: number, y: number, w: number, h: number, c1: string, c2: string | null) => {
      el('rect', { x, y, width: w, height: h, class: 'b1-tank-bg' }, svg);
      const liq = el('rect', { x, y: y + h, width: w, height: 0, class: c1 }, svg);
      const liq2 = c2 ? el('rect', { x, y: y + h, width: w, height: 0, class: c2 }, svg) : undefined;
      const mixr = c2 ? el('rect', { x, y: y + h, width: w, height: 0, class: 'b1-liquid-mix' }, svg) : undefined;
      el('rect', { x, y, width: w, height: h, class: 'b1-tank' }, svg);
      return { liq, liq2, mixr, x, y, w, h };
    };
    const L = tank(140, 18, 44, 56, 'b1-liquid1', null);
    const R = tank(214, 18, 44, 56, 'b1-liquid2', null);
    const M = tank(160, 100, 76, 40, 'b1-liquid1', 'b1-liquid2');
    // Sensoren: Kontaktpunkt am Behälter + Lampe, Reihenfolge A–F
    const sensorY = (t: { y: number; h: number }, frac: number) => t.y + t.h - frac * t.h;
    const sens: { dot: SVGElement; name: string }[] = [];
    const addSensor = (t: { x: number; y: number; w: number; h: number }, frac: number, side: 'l' | 'r', name: string) => {
      const y = sensorY(t, frac);
      const x = side === 'l' ? t.x : t.x + t.w;
      el('line', { x1: x, y1: y, x2: x + (side === 'l' ? -10 : 10), y2: y, class: 'dev-wire' }, svg);
      const l = led(svg, x + (side === 'l' ? -16 : 16), y, 4.5, 'red');
      label(svg, x + (side === 'l' ? -26 : 22), y + 4, name, 'dm-red-tag', side === 'l' ? 'end' : 'start');
      sens.push({ dot: l, name });
    };
    addSensor(L, 0.7, 'l', 'B'); addSensor(L, 0.1, 'l', 'A');
    addSensor(R, 0.7, 'r', 'D'); addSensor(R, 0.1, 'r', 'C');
    addSensor(M, 0.72, 'r', 'F'); addSensor(M, 0.06, 'r', 'E');
    sens.sort((a, b) => a.name.localeCompare(b.name));
    // Rohre und Ventile
    const flows = [
      pipe(svg, 'M118 6 H162 V18'), // 0: Zulauf links
      pipe(svg, 'M294 6 H236 V18'), // 1: Zulauf rechts
      pipe(svg, 'M162 74 V90 H190 V100'), // 2: links → Mischbehälter
      pipe(svg, 'M236 74 V90 H206 V100'), // 3: rechts → Mischbehälter
    ];
    const outflow = pipe(svg, 'M198 140 V154'); // 5: Ablauf
    const valves = [
      valve(svg, 140, 6, '0'), valve(svg, 268, 6, '1'),
      valve(svg, 162, 84, '2'), valve(svg, 236, 84, '3'),
    ];
    const v5 = valve(svg, 198, 148, '5');
    // Rührmotor (4)
    el('circle', { cx: 198, cy: 88, r: 9, class: 'dm-motor' }, svg);
    label(svg, 198, 91, 'M', 'dev-tiny', 'middle');
    label(svg, 198, 76, '4', 'dm-red-tag', 'middle');
    el('line', { x1: 198, y1: 97, x2: 198, y2: 130, stroke: '#444', 'stroke-width': 2 }, svg);
    const prop = el('g', { class: 'b1-spin' }, svg);
    el('ellipse', { cx: 190, cy: 128, rx: 8, ry: 3, class: 'b1-stirrer' }, prop);
    el('ellipse', { cx: 206, cy: 128, rx: 8, ry: 3, class: 'b1-stirrer' }, prop);
    // Demultiplexer-Ausgänge als Lämpchen (0–5)
    const yl = [0, 1, 2, 3, 4, 5].map((i) => {
      const r = led(svg, 98, 22 + i * 7.5, 2.6, 'green');
      return r;
    });
    label(svg, 104, 17, 'Y', 'dm-tiny2', 'end');
    SENSOR_NAMES.forEach((n, i) => label(svg, 104, 99 + i * 9, `${i} ${n}`, 'dm-tiny2', 'end'));
    const setH = (r: SVGElement, t: { y: number; h: number }, from: number, vol: number) => {
      const h = (vol / cap) * t.h;
      r.setAttribute('y', String(t.y + t.h - from - h)); r.setAttribute('height', String(h));
    };
    return bindLogic(svg, logic, () => {
      setH(L.liq, L, 0, logic.left);
      setH(R.liq, R, 0, logic.right);
      const m1 = (logic.mix1 / cap) * M.h, m2 = (logic.mix2 / cap) * M.h;
      const mixed = logic.mixLevel > 0 ? logic.mixing : 0;
      M.liq.setAttribute('y', String(M.y + M.h - m1)); M.liq.setAttribute('height', String(m1));
      M.liq2!.setAttribute('y', String(M.y + M.h - m1 - m2)); M.liq2!.setAttribute('height', String(m2));
      M.mixr!.setAttribute('y', String(M.y + M.h - m1 - m2)); M.mixr!.setAttribute('height', String(m1 + m2));
      M.mixr!.setAttribute('fill-opacity', String(m1 > 0 && m2 > 0 ? mixed : 0));
      const s = logic.sensors();
      sens.forEach((e, i) => setLit(e.dot, s[i] ? 1 : 0));
      [0, 1, 2, 3].forEach((i) => { valves[i]!(logic.active(i)); flows[i]!(logic.active(i)); });
      v5(logic.active(5)); outflow(logic.active(5) && logic.mixLevel > 0);
      prop.classList.toggle('on', logic.active(4));
      yl.forEach((l, i) => setLit(l, logic.active(i) ? 1 : 0));
    });
  },
};
