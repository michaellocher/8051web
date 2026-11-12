/** Parkhaus mit 31 Plätzen: Platzanzeige, Ein- und Ausfahrtschranke, Ampel, Tasten auf INT0/INT1. */
import { board, el, led, pushButton, setLit, type DeviceDef } from '../kit.ts';
import { bindLogic, label, pinRows } from './b1-view.ts';
import { ParkhausLogic } from './parkhaus.logic.ts';

export const parkhaus: DeviceDef = {
  id: 'parkhaus', name: 'Parkhaus', group: 'Aufzüge & Tore', ports: 1, width: 240, usesP3: true,
  desc: 'Parkhaus mit 31 Plätzen. Alle Pins sind Ausgänge: der Wert von D0–D4 wird als Dezimalwert (freie Plätze, 0–31) unter dem P-Schild angezeigt. '
    + 'D5 = Einfahrt-Schranke auf/zu (1 = auf), D6 = Ausfahrt-Schranke auf/zu (1 = auf), D7 = Ampel grün/rot (1 = grün). '
    + 'Die Einfahrt-Taste (in, +) löst den Interrupt 0 (INT0, P3.2) aus, die Ausfahrt-Taste (out, −) den Interrupt 1 (INT1, P3.3); während des Drückens liegt der Pin auf Low.',
  create(onInput) {
    const logic = new ParkhausLogic();
    const svg = board(240, 1);
    pinRows(svg, [[0, 'D0'], [1, 'D1'], [2, 'D2'], [3, 'D3'], [4, 'D4'], [5, 'D5'], [6, 'D6'], [7, 'D7']], 40);
    el('rect', { x: 46, y: 4, width: 190, height: 152, rx: 4, class: 'dm-teal' }, svg);
    // Schild
    el('rect', { x: 52, y: 10, width: 30, height: 28, rx: 3, class: 'dm-psign' }, svg);
    label(svg, 67, 32, 'P', 'dm-psign-txt', 'middle');
    el('rect', { x: 52, y: 42, width: 30, height: 22, class: 'dm-count' }, svg);
    const count = label(svg, 67, 58, '0', 'dm-count-txt', 'middle');
    // Ampel
    const red = led(svg, 190, 18, 6, 'red');
    const green = led(svg, 210, 18, 6, 'green');
    // Fahrspuren: Einfahrt links, Ausfahrt rechts
    el('rect', { x: 46, y: 70, width: 190, height: 86, class: 'dm-asphalt' }, svg);
    el('rect', { x: 92, y: 70, width: 40, height: 86, class: 'dm-lane' }, svg);
    el('rect', { x: 166, y: 70, width: 40, height: 86, class: 'dm-lane' }, svg);
    label(svg, 112, 94, 'Ein', 'dm-lane-txt', 'middle');
    label(svg, 186, 94, 'Aus', 'dm-lane-txt', 'middle');
    el('path', { d: 'M104 140 L112 116 M112 116 L106 122 M112 116 L118 122', class: 'dm-arrow' }, svg);
    // Schranken (Drehpunkt unten, Arm steht im geschlossenen Zustand quer über der Spur)
    const bar = (x: number) => {
      el('rect', { x: x - 8, y: 100, width: 14, height: 16, class: 'dm-box' }, svg);
      const arm = el('g', { transform: `translate(${x} 104)` }, svg);
      el('line', { x1: 0, y1: 0, x2: 40, y2: 0, class: 'dm-arm' }, arm);
      el('line', { x1: 0, y1: 0, x2: 40, y2: 0, class: 'dm-arm-stripes' }, arm);
      return arm;
    };
    const entry = bar(88), exit = bar(162);
    label(svg, 78, 114, 'D5', 'dm-tag', 'end');
    label(svg, 152, 114, 'D6', 'dm-tag', 'end');
    label(svg, 200, 12, 'D7', 'dm-tag', 'middle');
    // Tasten
    const key = (x: number, text: string, set: (d: boolean) => void) => pushButton(svg, x, 134, 40, 18, text, (d) => { set(d); onInput(); });
    key(52, 'out', (d) => { logic.keyOut = d; });
    key(96, 'in', (d) => { logic.keyIn = d; });
    label(svg, 72, 131, '− INT1', 'dm-tag', 'middle');
    label(svg, 116, 131, '+ INT0', 'dm-tag', 'middle');
    return bindLogic(svg, logic, () => {
      count.textContent = String(logic.free);
      setLit(red, logic.green ? 0 : 1);
      setLit(green, logic.green ? 1 : 0);
      entry.setAttribute('transform', `translate(88 104) rotate(${-logic.entryBar * 80})`);
      exit.setAttribute('transform', `translate(162 104) rotate(${-logic.exitBar * 80})`);
    });
  },
};
