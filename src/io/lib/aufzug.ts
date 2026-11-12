/** Aufzug-1 (Lastenaufzug) und Aufzug-2 (Personenaufzug, 3 Stockwerke). */
import { board, el, led, pushButton, setLit, type DeviceDef } from '../kit.ts';
import { LampBank, bindLogic, label, pinRows, type Pin } from './b1-view.ts';
import { Aufzug1Logic, Aufzug2Logic } from './lift.logic.ts';

export const aufzug1: DeviceDef = {
  id: 'aufzug1', name: 'Aufzug-1', group: 'Aufzüge & Tore', ports: 1, width: 270,
  desc: 'Lastenaufzug. D0/D1 = Motoranschlüsse (Ausgänge): D0 = 1 und D1 = 0 aufwärts, D0 = 0 und D1 = 1 abwärts, gleiche Pegel = aus. '
    + 'D2 = Positionssensor unten, D3 = Positionssensor oben (Eingänge, 1 = Last am Sensor), D4 = Bedientaste aufwärts, D5 = Bedientaste abwärts (Eingänge, 1 = gedrückt). '
    + 'Die Fahrt über die ganze Strecke dauert 5 s.',
  create(onInput) {
    const logic = new Aufzug1Logic();
    const svg = board(270, 1);
    const pins: Pin[] = [[0, 'D0'], [1, 'D1'], [2, 'D2', true], [3, 'D3', true], [4, 'D4', true], [5, 'D5', true]];
    pinRows(svg, pins, 40);
    el('rect', { x: 46, y: 4, width: 220, height: 152, rx: 4, class: 'dm-grass' }, svg);
    // Schräge Fahrbahn von unten links nach oben rechts
    const ax = 88, ay = 112, bx = 226, by = 34;
    el('line', { x1: ax - 6, y1: ay - 3, x2: bx - 4, y2: by - 3, class: 'dm-rail' }, svg);
    el('line', { x1: ax - 6, y1: ay + 3, x2: bx - 4, y2: by + 3, class: 'dm-rail' }, svg);
    el('circle', { cx: ax - 6, cy: ay, r: 3, class: 'dm-joint' }, svg);
    el('circle', { cx: bx - 4, cy: by, r: 3, class: 'dm-joint' }, svg);
    el('rect', { x: 54, y: 118, width: 124, height: 5, class: 'dm-table' }, svg);
    el('rect', { x: 150, y: 123, width: 5, height: 26, class: 'dm-table' }, svg);
    el('rect', { x: 66, y: 123, width: 5, height: 26, class: 'dm-table' }, svg);
    el('rect', { x: 226, y: 52, width: 40, height: 4, class: 'dm-table' }, svg);
    // Motor
    el('circle', { cx: 62, cy: ay, r: 9, class: 'dm-motor' }, svg);
    label(svg, 62, ay + 3, 'M', 'dev-tiny', 'middle');
    el('line', { x1: 71, y1: ay, x2: ax - 8, y2: ay, class: 'dev-wire' }, svg);
    // Sensoren
    const sBottom = led(svg, 116, 140, 6, 'red');
    label(svg, 126, 144, 'D2', 'dm-red-tag');
    const sTop = led(svg, 232, 66, 6, 'red');
    label(svg, 212, 82, 'D3', 'dm-red-tag');
    // Last am Rollwagen
    const car = el('g', {}, svg);
    el('line', { x1: 0, y1: 0, x2: -8, y2: 12, class: 'dm-hang' }, car);
    el('line', { x1: 0, y1: 0, x2: 8, y2: 12, class: 'dm-hang' }, car);
    el('rect', { x: -14, y: 12, width: 28, height: 12, class: 'dm-crate' }, car);
    el('rect', { x: -10, y: 8, width: 6, height: 4, class: 'dm-load r' }, car);
    el('rect', { x: -2, y: 5, width: 6, height: 7, class: 'dm-load g' }, car);
    el('rect', { x: 6, y: 8, width: 6, height: 4, class: 'dm-load d' }, car);
    // Bedienfeld
    el('rect', { x: 196, y: 98, width: 70, height: 58, rx: 6, class: 'dm-panel' }, svg);
    pushButton(svg, 232, 104, 30, 20, 'up', (d) => { logic.keyUp = d; onInput(); });
    pushButton(svg, 232, 130, 30, 20, 'dn', (d) => { logic.keyDown = d; onInput(); });
    label(svg, 214, 118, 'D4', 'dm-red-tag');
    label(svg, 214, 144, 'D5', 'dm-red-tag');
    return bindLogic(svg, logic, () => {
      const t = logic.pos;
      car.setAttribute('transform', `translate(${ax + (bx - ax) * t} ${ay + (by - ay) * t})`);
      setLit(sBottom, logic.atBottom ? 1 : 0);
      setLit(sTop, logic.atTop ? 1 : 0);
    });
  },
};

export const aufzug2: DeviceDef = {
  id: 'aufzug2', name: 'Aufzug-2', group: 'Aufzüge & Tore', ports: 1, width: 200,
  desc: 'Personenaufzug für 3 Stockwerke (A oben, B, C unten). D0 = Meldelampe A, D1 = Meldelampe B, D2 = Meldelampe C, D3/D4 = Motoranschlüsse '
    + '(D3 = 1 und D4 = 0 aufwärts, D3 = 0 und D4 = 1 abwärts, gleiche Pegel = Motor aus) – alles Ausgänge. '
    + 'D5, D6, D7 = Signale der Istwertgeber der Stockwerke A, B, C (Eingänge, 1 = Kabine steht am Stockwerk). Die Kabine braucht 2 s je Stockwerk.',
  create() {
    const logic = new Aufzug2Logic();
    const svg = board(200, 1);
    pinRows(svg, [[0, 'D0'], [1, 'D1'], [2, 'D2'], [3, 'D3'], [4, 'D4'], [5, 'D5', true], [6, 'D6', true], [7, 'D7', true]], 40);
    el('rect', { x: 46, y: 4, width: 150, height: 152, rx: 4, class: 'dm-wall' }, svg);
    // drei Stockwerke: A oben (y 8..56), B, C unten
    const fy = (i: number) => 8 + i * 48; // Oberkante Stockwerk i (0 = A)
    const sens = [0, 1, 2].map((i) => {
      el('rect', { x: 50, y: fy(i), width: 38, height: 46, class: 'dm-floor' }, svg);
      label(svg, 54, fy(i) + 26, `D${5 + i}`, 'dm-yellow-tag');
      return led(svg, 80, fy(i) + 22, 5, 'red');
    });
    el('rect', { x: 92, y: 8, width: 56, height: 144, class: 'dm-shaft' }, svg);
    const cabin = el('g', {}, svg);
    el('rect', { x: 94, y: 0, width: 52, height: 44, rx: 2, class: 'dm-cabin' }, cabin);
    // Personen
    el('circle', { cx: 108, cy: 14, r: 4.5, class: 'dm-head' }, cabin);
    el('rect', { x: 103, y: 19, width: 10, height: 20, rx: 3, class: 'dm-body red' }, cabin);
    el('circle', { cx: 133, cy: 12, r: 4.5, class: 'dm-head' }, cabin);
    el('rect', { x: 128, y: 17, width: 10, height: 22, rx: 3, class: 'dm-body violet' }, cabin);
    el('circle', { cx: 120, cy: 28, r: 3.5, class: 'dm-head' }, cabin);
    el('rect', { x: 116, y: 32, width: 8, height: 8, rx: 2, class: 'dm-body green' }, cabin);
    // Meldelampen A–C
    const names = ['A', 'B', 'C'];
    const lamps = names.map((n, i) => {
      el('rect', { x: 154, y: fy(i) + 2, width: 38, height: 42, class: 'dm-lampbox' }, svg);
      const r = el('rect', { x: 162, y: fy(i) + 9, width: 24, height: 24, rx: 2, class: 'dm-lamp' }, svg);
      label(svg, 174, fy(i) + 27, n, 'dm-lamp-txt', 'middle');
      return r;
    });
    const bank = new LampBank(lamps, (i, [p = 0]) => ((p >> i) & 1) === 1);
    const base = bindLogic(svg, logic, () => {
      cabin.setAttribute('transform', `translate(0 ${fy(0) + (2 - logic.pos) * 48 - 2})`);
      sens.forEach((s, i) => setLit(s, logic.atFloor(i) ? 1 : 0));
      bank.render();
    });
    return { ...base, sample(pins, cycles) { bank.sample(pins, cycles); base.sample(pins, cycles); } };
  },
};
