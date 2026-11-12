/** PC-Tastatur mit ASCII-Ausgabe. */
import { board, el, pushButton, rowY, wire, type DeviceDef } from '../kit.ts';
import { label, selectButton } from './b2util.ts';
import { AsciiKeyboard, asciiFromKey } from './keyboard.logic.ts';

interface Key { n: string; s?: string; code?: number; w?: number }
const ch = (n: string, s?: string): Key => (s === undefined ? { n } : { n, s });
const ROWS: Key[][] = [
  [...'1234567890'].map((d, i) => ch(d, '!"#$%&/()='[i])).concat([{ n: '⌫', code: 8, w: 1.3 }]),
  [...'qwertzuiop'].map((c) => ch(c, c.toUpperCase())),
  [...'asdfghjkl'].map((c) => ch(c, c.toUpperCase())).concat([{ n: '⏎', code: 13, w: 1.6 }]),
  [{ n: '' }, ...[...'yxcvbnm'].map((c) => ch(c, c.toUpperCase())), ch(',', ';'), ch('.', ':'), ch('-', '_')],
  [{ n: 'Esc', code: 27, w: 1.6 }, { n: 'Leertaste', code: 32, w: 6 }, { n: 'Tab', code: 9, w: 1.6 }],
];

const keyboard: DeviceDef = {
  id: 'keyboard', name: 'Tastatur (ASCII)', group: 'Erweiterungen (nicht im Original)', ports: 1, width: 300,
  desc: 'PC-Tastatur mit ASCII-Ausgabe. Px.0–Px.6 = 7-Bit-ASCII-Code, Px.7 = Strobe (0 = Zeichen bereit). Das Programm quittiert gelesene Zeichen mit einem Low-Impuls an Px.7 (CLR/SETB), danach liefert der 16-Zeichen-Puffer das nächste. Auch per PC-Tastatur, wenn das Gerät fokussiert ist.',
  create(onInput) {
    const svg = board(300, 1, 'ASCII');
    const kb = new AsciiKeyboard();
    for (let i = 0; i < 7; i++) { wire(svg, i, 34, true); label(svg, 9, rowY(i) - 3, `D${i}`); }
    wire(svg, 7, 34); label(svg, 9, rowY(7) - 3, 'STB');
    el('rect', { x: 46, y: 4, width: 248, height: 20, rx: 3, class: 'b2-kb-display' }, svg);
    const disp = label(svg, 52, 18, '', 'b2-kb-txt');
    let shift = false;
    const cap: { txt: SVGTextElement; k: Key }[] = [];
    const emit = (code: number) => { kb.press(code); onInput(); };
    const U = 22;
    let shiftBtn: ReturnType<typeof selectButton> | undefined;
    ROWS.forEach((row, r) => {
      let x = 46 + (r === 2 ? 8 : 0);
      row.forEach((k) => {
        const w = (k.w ?? 1) * U - 2;
        if (r === 3 && k.n === '') {
          shiftBtn = selectButton(svg, x, 30 + r * 25, w + U * 0.4, 22, '⇧', () => { shift = !shift; refresh(); });
          x += w + U * 0.4 + 2;
          return;
        }
        const g = pushButton(svg, x, 30 + r * 25, w, 22, k.n, (down) => { if (down) emit(k.code ?? (shift && k.s ? k.s : k.n).charCodeAt(0)); }, 'key b2-kb-key');
        const txt = g.querySelector('text')!;
        cap.push({ txt, k });
        x += w + 2;
      });
    });
    const refresh = () => {
      shiftBtn?.setActive(shift);
      for (const { txt, k } of cap) if (k.s) txt.textContent = shift ? k.s : k.n;
    };
    refresh();
    svg.setAttribute('tabindex', '0');
    svg.addEventListener('keydown', (e) => {
      if (e.ctrlKey || e.metaKey || e.altKey) return;
      const code = asciiFromKey(e.key);
      if (code === undefined) return;
      e.preventDefault();
      e.stopPropagation();
      if (!e.repeat) emit(code);
    }, true);
    const show = (c: number) => (c < 32 ? `^${String.fromCharCode(c + 64)}` : c === 32 ? '␣' : c === 127 ? 'DEL' : String.fromCharCode(c));
    return {
      svg,
      drive: () => kb.drive(),
      sample() {},
      write(_i, latch) { kb.write(latch); },
      render() {
        const l = kb.last;
        disp.textContent = `${l === undefined ? '–' : `'${show(l)}' = ${l.toString(16).toUpperCase().padStart(2, '0')}h`}   Puffer: ${kb.queue.length}${kb.ready ? '  STROBE' : ''}`;
      },
    };
  },
};

export const KEYBOARD_DEVICES: readonly DeviceDef[] = [keyboard];
