/** HEX-Tastatur und Matrix-Tastatur (reine Logik, kein DOM). */

export interface HexKey { readonly label: string; readonly code: number; readonly row: number; readonly col: number; readonly wide?: boolean }

/** Tastenfeld der HEX-Tastatur wie im Handbuch: Zeile 0: C D E F /, … Zeile 4: = (breit) und C-Taste */
export const HEX_KEYS: readonly HexKey[] = [
  ...[[0xc, 0xd, 0xe, 0xf], [8, 9, 0xa, 0xb], [4, 5, 6, 7], [0, 1, 2, 3]].flatMap((row, r) =>
    row.map((k, c): HexKey => ({ label: k.toString(16).toUpperCase(), code: k, row: r, col: c }))),
  { label: '/', code: 0x10, row: 0, col: 4 },
  { label: '*', code: 0x11, row: 1, col: 4 },
  { label: '-', code: 0x12, row: 2, col: 4 },
  { label: '+', code: 0x13, row: 3, col: 4 },
  { label: '=', code: 0x15, row: 4, col: 0, wide: true },
  { label: 'C', code: 0x14, row: 4, col: 4 },
];
export const HEX_NONE = 0xff;

/** PC-Taste → Tastencode der HEX-Tastatur */
export function hexKeyFromPc(key: string): number | undefined {
  if (/^[0-9a-f]$/i.test(key)) return parseInt(key, 16);
  switch (key) {
    case '/': return 0x10;
    case '*': return 0x11;
    case '-': return 0x12;
    case '+': return 0x13;
    case 'Escape': case 'Delete': case 'Backspace': return 0x14;
    case '=': case 'Enter': return 0x15;
    default: return undefined;
  }
}

/**
 * HEX-Tastatur: der Code der gedrückten Taste (00h–15h) liegt an D0–D7, FFh = keine Taste.
 * Der Tastendruck wird gespeichert; es kann immer nur eine Taste gedrückt sein
 * (eine weitere Taste ersetzt die gespeicherte, erneutes Betätigen löst sie).
 */
export class HexKeypad {
  key: number | undefined;
  press(code: number) { this.key = this.key === code ? undefined : code; }
  release() { this.key = undefined; }
  drive(): number { return this.key === undefined ? HEX_NONE : this.key; }
}

export const MATRIX_ROWS = 4, MATRIX_COLS = 3;
export const MATRIX_LABELS = [['1', '2', '3'], ['4', '5', '6'], ['7', '8', '9'], ['*', '0', '#']] as const;

/**
 * Matrix-Tastatur 4 Zeilen × 3 Spalten. Das Programm legt die Zeilen Y1–Y4 (D3–D6) nacheinander auf 0
 * und liest die Spalten X1–X3 (D0–D2, vorher auf 1 setzen). Eine betätigte Taste bleibt gespeichert
 * („X"), bis sie erneut betätigt wird.
 */
export class MatrixKeypad {
  readonly down: boolean[] = Array.from({ length: MATRIX_ROWS * MATRIX_COLS }, () => false);
  toggle(r: number, c: number) { const i = r * MATRIX_COLS + c; this.down[i] = !this.down[i]; }
  isDown(r: number, c: number): boolean { return this.down[r * MATRIX_COLS + c] === true; }
  /** Pegel an den Portpins: eine Spalte wird 0, wenn eine Taste ihrer 0-getriebenen Zeile gedrückt ist */
  drive(latch: number): number {
    let v = 0xff;
    for (let r = 0; r < MATRIX_ROWS; r++) {
      if (((latch >> (3 + r)) & 1) !== 0) continue;
      for (let c = 0; c < MATRIX_COLS; c++) if (this.isDown(r, c)) v &= ~(1 << c);
    }
    return v;
  }
}
