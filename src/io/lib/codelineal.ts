/** Codelineal: Schlitten mit vier Lichtschranken über Dual- oder Gray-Codelineal. */
import { board, el, rowY, type DeviceDef } from '../kit.ts';
import { CodelinealLogic, toGray } from './codelineal.logic.ts';
import { bindLogic, label, pinRows } from './b1-view.ts';

export const codelineal: DeviceDef = {
  id: 'codelineal', name: 'Codelineal', group: 'Antriebe', ports: 1, width: 280,
  desc: 'Positioniereinrichtung mit Codelineal (16 Positionen). Der Positioniermotor wird über D4 und D5 gesteuert (Ausgänge): D4 = 1 und D5 = 0 → Schlitten nach rechts, D4 = 0 und D5 = 1 → nach links, '
    + 'bei gleichen Signalen steht der Schlitten. Die Position wird mit je einer Lichtschranke pro Kanal abgetastet, angezeigt und auf die Datenausgänge D0–D3 übertragen (Eingänge des Ports, '
    + 'D0 = oberste Spur = niedrigstes Bit, helle Spur = 1). Umschaltbar: Dual- oder Gray-Codelineal (Taste unten) und „ideal“ oder „real“ abtasten (Taste oben). '
    + 'Bei „realer“ Abtastung steht der Abtastschlitten leicht schräg, was beim Dualcodelineal zu Abtastfehlern führt.',
  create() {
    const logic = new CodelinealLogic();
    const svg = board(280, 1);
    pinRows(svg, [[0, 'D0', true], [1, 'D1', true], [2, 'D2', true], [3, 'D3', true], [4, 'D4'], [5, 'D5']], 40);
    el('rect', { x: 46, y: 4, width: 230, height: 152, rx: 4, class: 'dm-panel-grey' }, svg);
    // Anzeige: vier Lichtschranken-Kästchen und Dezimalwert
    const dots = [0, 1, 2, 3].map((i) => el('rect', { x: 88, y: 12 + i * 12, width: 12, height: 10, class: 'dm-bit' }, svg));
    [0, 1, 2, 3].forEach((i) => el('path', { d: `M42 ${rowY(i)} H${60 + (i % 2) * 6} V${17 + i * 12} H88`, class: 'dev-wire', fill: 'none' }, svg));
    label(svg, 106, 38, '=', 'dm-eq');
    el('rect', { x: 116, y: 20, width: 40, height: 28, class: 'dm-count' }, svg);
    const val = label(svg, 150, 41, '0', 'dm-count-txt', 'end');
    // Modus-Tasten
    const modeBtn = (y: number, cls: string, onClick: () => void) => {
      const g = el('g', { class: 'dev-btn', transform: `translate(56 ${y})`, tabindex: 0, role: 'button' }, svg);
      el('rect', { x: 0, y: 0, width: 18, height: 14, rx: 2 }, g);
      el('path', { d: 'M20 3 l5 4 l-5 4 z', class: cls }, svg).setAttribute('transform', `translate(54 ${y})`);
      g.addEventListener('click', onClick);
      g.addEventListener('keydown', (e) => { if (e.key === ' ' || e.key === 'Enter') { e.preventDefault(); onClick(); } });
      return g;
    };
    modeBtn(8, 'dm-mode-r', () => { logic.real = !logic.real; });
    modeBtn(136, 'dm-mode-b', () => { logic.gray = !logic.gray; drawRuler(); });
    const modeTxt = label(svg, 160, 20, 'ideal', 'dm-mode-txt-r', 'start');
    const codeTxt = label(svg, 160, 150, 'Gray-Code', 'dm-mode-txt-b', 'start');
    // Motor + Schiene
    el('circle', { cx: 76, cy: 66, r: 8, class: 'dm-motor' }, svg);
    label(svg, 76, 69, 'M', 'dev-tiny', 'middle');
    el('path', { d: `M42 ${rowY(4)} H60 V62 H68 M42 ${rowY(5)} H66 V74 H70`, class: 'dev-wire', fill: 'none' }, svg);
    const rx = 84, rw = 184; // Lineal
    el('rect', { x: rx, y: 62, width: rw, height: 3, class: 'dm-track' }, svg);
    // Codelineal: 16 Felder × 4 Spuren (oben Spur 0)
    const cw = rw / 16, ry = 76, rh = 12;
    const cells: SVGRectElement[][] = [];
    for (let t = 0; t < 4; t++) {
      cells.push([]);
      for (let c = 0; c < 16; c++) cells[t]!.push(el('rect', { x: rx + c * cw, y: ry + t * rh, width: cw + 0.3, height: rh, class: 'dm-cell' }, svg));
    }
    el('rect', { x: rx, y: ry, width: rw, height: 4 * rh, class: 'b1-ruler-frame' }, svg);
    el('rect', { x: rx, y: ry + 4 * rh, width: rw, height: 10, class: 'dm-scale' }, svg);
    for (let c = 0; c < 16; c += 2) label(svg, rx + c * cw + cw / 2, ry + 4 * rh + 8, String(c), 'dm-scale-txt', 'middle');
    // Schlitten (mit schrägem Abtastbalken im Modus „real“)
    const slide = el('g', {}, svg);
    el('rect', { x: -2, y: 62, width: 4, height: 3, class: 'dm-slide-head' }, slide);
    const bar = el('line', { x1: 0, y1: 64, x2: 0, y2: ry + 4 * rh + 2, class: 'dm-red-line' }, slide);
    const eyes = [0, 1, 2, 3].map((t) => el('circle', { cx: 0, cy: ry + t * rh + rh / 2, r: 2.4, class: 'dm-eye' }, slide));
    let drawn: boolean | undefined;
    function drawRuler() {
      drawn = logic.gray;
      for (let t = 0; t < 4; t++) for (let c = 0; c < 16; c++) {
        const b = ((logic.gray ? toGray(c) : c) >> t) & 1;
        cells[t]![c]!.classList.toggle('w', b === 1);
      }
    }
    drawRuler();
    return bindLogic(svg, logic, () => {
      if (drawn !== logic.gray) drawRuler();
      const x = rx + logic.pos * cw;
      slide.setAttribute('transform', `translate(${x} 0)`);
      eyes.forEach((e, i) => e.setAttribute('cx', String(logic.real ? logic.offsets[i]! * cw : 0)));
      bar.setAttribute('x2', String(logic.real ? logic.offsets[3]! * cw : 0));
      bar.setAttribute('x1', String(logic.real ? logic.offsets[0]! * cw : 0));
      const code = logic.code;
      dots.forEach((d, i) => d.classList.toggle('on', ((code >> i) & 1) === 1));
      val.textContent = String(code);
      modeTxt.textContent = logic.real ? 'real' : 'ideal';
      codeTxt.textContent = logic.gray ? 'Gray-Code' : 'Dual-Code';
    });
  },
};
