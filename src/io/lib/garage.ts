/** Garage: Garagentor mit Fernbedienungstaste, Endschaltern und Warnton. */
import { board, el, setLit, led, type DeviceDef } from '../kit.ts';
import { Beeper, bindLogic, carShape, label, pinRows } from './b1-view.ts';
import { GarageLogic } from './garage.logic.ts';

export const garage: DeviceDef = {
  id: 'garage', name: 'Garage', group: 'Aufzüge & Tore', ports: 1, width: 260,
  desc: 'Garagentor (Fahrzeit 5 s), gesteuert über die Fernbedienungstaste D0 (Eingang, 1 = gedrückt). D1 = Endschalter unten (Tor zu), D2 = Endschalter oben (Tor auf) (Eingänge, 1 = betätigt). '
    + 'D3 = 1 und D4 = 0 → Tor hoch, D3 = 0 und D4 = 1 → Tor runter, gleiche Pegel → Tormotor aus (Ausgänge). Beim Überfahren eines Endschalters ertönt ein Warnton.',
  create(onInput) {
    const logic = new GarageLogic();
    const beeper = new Beeper();
    const svg = board(260, 1);
    pinRows(svg, [[0, 'D0', true], [1, 'D1', true], [2, 'D2', true], [3, 'D3'], [4, 'D4']], 40);
    el('rect', { x: 46, y: 4, width: 210, height: 152, rx: 4, class: 'dm-sky' }, svg);
    el('rect', { x: 46, y: 70, width: 210, height: 86, class: 'dm-grass' }, svg);
    el('path', { d: 'M46 156 L120 96 L256 96 L256 156 Z', class: 'dm-drive' }, svg);
    // Garage
    el('rect', { x: 150, y: 14, width: 104, height: 84, class: 'dm-garage-wall' }, svg);
    el('path', { d: 'M144 16 L250 2 L254 14 L150 14 Z', class: 'dm-roof' }, svg);
    el('rect', { x: 160, y: 24, width: 84, height: 74, class: 'dm-opening' }, svg);
    const panel = el('rect', { x: 160, y: 24, width: 84, height: 74, class: 'dm-gdoor' }, svg);
    const ribs = el('path', { d: '', class: 'dm-gdoor-ribs' }, svg);
    // Büsche
    el('circle', { cx: 74, cy: 44, r: 14, class: 'dm-bush' }, svg);
    el('circle', { cx: 100, cy: 54, r: 12, class: 'dm-bush' }, svg);
    // Auto
    const car = carShape(svg, '');
    car.setAttribute('transform', 'translate(60 112) scale(2.4)');
    // Endschalter-Anzeige
    const swBottom = led(svg, 153, 92, 4.5, 'red');
    label(svg, 153, 106, 'D1', 'dm-tag', 'middle');
    const swTop = led(svg, 240, 12, 4.5, 'red');
    label(svg, 232, 15, 'D2', 'dm-tag', 'end');
    // Fernbedienungstaste
    const keyG = el('g', { class: 'dev-btn key', transform: 'translate(212 118)', tabindex: 0, role: 'button' }, svg);
    el('rect', { x: 0, y: 0, width: 34, height: 30, rx: 3 }, keyG);
    const keyTxt = el('text', { x: 17, y: 21, 'text-anchor': 'middle' }, keyG);
    keyTxt.textContent = '0';
    const setKey = (d: boolean) => { logic.key = d; keyG.classList.toggle('down', d); keyTxt.textContent = d ? '1' : '0'; onInput(); };
    keyG.addEventListener('pointerdown', (e) => { try { keyG.setPointerCapture(e.pointerId); } catch { /* synthetisch */ } setKey(true); });
    keyG.addEventListener('pointerup', () => setKey(false));
    keyG.addEventListener('pointercancel', () => setKey(false));
    keyG.addEventListener('keydown', (e) => { if ((e.key === ' ' || e.key === 'Enter') && !e.repeat) { e.preventDefault(); setKey(true); } });
    keyG.addEventListener('keyup', (e) => { if (e.key === ' ' || e.key === 'Enter') setKey(false); });
    label(svg, 229, 114, 'D0', 'dm-tag', 'middle');
    const warn = el('g', { class: 'dm-warn', transform: 'translate(52 8)' }, svg);
    el('rect', { x: 0, y: 0, width: 70, height: 14, rx: 3 }, warn);
    label(warn, 35, 10, 'Warnton!', 'dm-warn-txt', 'middle');
    warn.style.display = 'none';
    const base = bindLogic(svg, logic, () => {
      const h = 74 * (1 - logic.door);
      panel.setAttribute('height', String(h));
      let d = '';
      for (let y = 24 + 10; y < 24 + h; y += 10) d += `M160 ${y} H244 `;
      ribs.setAttribute('d', d);
      setLit(swBottom, logic.endBottom ? 1 : 0);
      setLit(swTop, logic.endTop ? 1 : 0);
      beeper.on(logic.beep);
      warn.style.display = logic.beep ? '' : 'none';
    });
    return { ...base, destroy: () => beeper.destroy() };
  },
};
