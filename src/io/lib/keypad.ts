/** HEX-Tastatur und Matrix-Tastatur. */
import { board, el, rowY, type DeviceDef } from '../kit.ts';
import { label } from './b2util.ts';
import { HEX_KEYS, HexKeypad, MATRIX_LABELS, MatrixKeypad, hexKeyFromPc } from './keypad.logic.ts';

/** Taste, die beim Betätigen einrastet und mit „X" angezeigt wird (Klick = betätigen/lösen) */
function latchingKey(svg: SVGSVGElement, x: number, y: number, w: number, h: number, text: string, onClick: () => void) {
  const g = el('g', { class: 'dev-btn key', transform: `translate(${x} ${y})`, tabindex: 0, role: 'button' }, svg);
  el('rect', { x: 0, y: 0, width: w, height: h, rx: 4 }, g);
  const t = el('text', { x: w / 2, y: h / 2 + 4, 'text-anchor': 'middle' }, g);
  t.textContent = text;
  g.addEventListener('click', onClick);
  g.addEventListener('keydown', (e) => { if (e.key === ' ' || e.key === 'Enter') { e.preventDefault(); e.stopPropagation(); onClick(); } });
  return {
    setDown(d: boolean) { g.classList.toggle('down', d); t.textContent = d ? 'X' : text; },
  };
}

const hexkeys: DeviceDef = {
  id: 'hexkeys', name: 'HEX-Tastatur', group: 'Tastaturen', ports: 1, width: 190,
  desc: 'Tastatur mit 22 Tasten (0–F, /, *, -, +, C, =). Der Code der Taste liegt auf D0–D7: Tasten 0–F = 00h–0Fh, / = 10h, * = 11h, - = 12h, + = 13h, C = 14h, = = 15h, keine Taste = FFh. Der Tastendruck wird gespeichert (angezeigt mit „X"); es kann immer nur eine Taste gedrückt sein. Auch per PC-Tastatur bei fokussiertem Gerät (0–9, A–F, / * - +, Esc = C, Enter = =).',
  create(onInput) {
    const svg = board(190, 1);
    for (let i = 0; i < 8; i++) {
      const y = rowY(i);
      el('line', { x1: 0, y1: y, x2: 14, y2: y, class: 'dev-wire' }, svg);
      el('path', { d: `M5 ${y - 3.5} L0 ${y} L5 ${y + 3.5}`, class: 'dev-arrow' }, svg);
      label(svg, 9, y - 3, `D${i}`);
    }
    const pad = new HexKeypad();
    const cellW = 26, cellH = 28, x0 = 40, y0 = 8;
    const keys = new Map<number, ReturnType<typeof latchingKey>>();
    const refresh = () => { for (const [code, k] of keys) k.setDown(pad.key === code); };
    for (const k of HEX_KEYS) {
      const w = k.wide ? cellW * 4 + 3 * 2 : cellW;
      keys.set(k.code, latchingKey(svg, x0 + k.col * (cellW + 2), y0 + k.row * (cellH + 2), w, cellH, k.label, () => { pad.press(k.code); refresh(); onInput(); }));
    }
    svg.setAttribute('tabindex', '0');
    svg.addEventListener('keydown', (e) => {
      if (e.ctrlKey || e.metaKey || e.altKey || e.repeat) return;
      const code = hexKeyFromPc(e.key);
      if (code === undefined) return;
      e.preventDefault();
      pad.press(code); refresh(); onInput();
    });
    return { svg, drive: () => pad.drive(), sample() {}, render() {} };
  },
};

const matrix: DeviceDef = {
  id: 'matrix', name: 'Matrix-Tastatur 4×3', group: 'Tastaturen', ports: 1, width: 180,
  desc: '4 Zeilen × 3 Spalten, Schaltkontakte an den Kreuzungspunkten. Die Zeilen Y1–Y4 (D3–D6 = Px.3–Px.6) legt das Programm nacheinander auf 0, die Spalten X1–X3 (D0–D2 = Px.0–Px.2, vorher auf 1 setzen) werden gelesen: eine gedrückte Taste zieht ihre Spalte auf 0. Eine betätigte Taste zeigt „X" und bleibt gespeichert, bis sie erneut betätigt wird. Auch per PC-Tastatur (0–9, *, #) bei fokussiertem Gerät.',
  create(onInput) {
    const svg = board(180, 1);
    ['X1', 'X2', 'X3', 'Y1', 'Y2', 'Y3', 'Y4'].forEach((n, i) => {
      const y = rowY(i);
      el('line', { x1: 0, y1: y, x2: 38, y2: y, class: 'dev-wire' }, svg);
      // X1–X3: Signale zum Port (Pfeil links), Y1–Y4: vom Port zur Tastatur (Pfeil rechts)
      if (i < 3) el('path', { d: `M5 ${y - 3.5} L0 ${y} L5 ${y + 3.5}`, class: 'dev-arrow' }, svg);
      else el('path', { d: `M33 ${y - 3.5} L38 ${y} L33 ${y + 3.5}`, class: 'dev-arrow' }, svg);
      label(svg, 12, y - 3, n);
    });
    const pad = new MatrixKeypad();
    const btns: ReturnType<typeof latchingKey>[][] = [];
    const refresh = () => btns.forEach((row, r) => row.forEach((b, c) => b.setDown(pad.isDown(r, c))));
    const byChar = new Map<string, [number, number]>();
    MATRIX_LABELS.forEach((row, r) => {
      btns[r] = row.map((k, c) => {
        byChar.set(k, [r, c]);
        return latchingKey(svg, 62 + c * 38, 6 + r * 37, 34, 32, k, () => { pad.toggle(r, c); refresh(); onInput(); });
      });
    });
    svg.setAttribute('tabindex', '0');
    svg.addEventListener('keydown', (e) => {
      if (e.ctrlKey || e.metaKey || e.altKey || e.repeat) return;
      const rc = byChar.get(e.key);
      if (!rc) return;
      e.preventDefault();
      pad.toggle(rc[0], rc[1]); refresh(); onInput();
    });
    return { svg, drive: (_i, latch) => pad.drive(latch), sample() {}, render() {} };
  },
};

export const KEYPAD_DEVICES: readonly DeviceDef[] = [hexkeys, matrix];
