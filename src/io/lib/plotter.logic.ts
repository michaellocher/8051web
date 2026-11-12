/** XY-Plotter nach Handbuch (reine Logik, kein DOM): 4 Farben, 80 × 80 Pixel, ein Port. */
import { bit, clamp, type PortLogic } from './b1-common.ts';

export const SIZE = 80;
/** Stiftfarben nach Index; D5/D6: 00 schwarz, 10 rot (D5 = 1), 01 blau (D6 = 1), 11 grün */
export const COLORS = ['black', 'red', 'blue', 'green'] as const;
export type PlotColor = (typeof COLORS)[number];

/**
 * Datenleitungen (alle Ausgänge des Ports, high-aktiv):
 * D0 x+1, D1 x−1, D2 y+1, D3 y−1 (je eine Schrittbewegung bei steigender Flanke 0→1), D4 Stiftlage (0 hoch, 1 unten),
 * D5/D6 Stiftfarbe, D7 Reset (solange 1: Position 0,0, Zeichenfläche und Warnlampe gelöscht).
 * Verlässt der Stift die Zeichenfläche (x, y außerhalb 0…79), leuchtet die Warnlampe rot, bis Reset.
 */
export class PlotterLogic implements PortLogic {
  /** Stiftposition (y nach oben); der Stift kann die Fläche (bis zum Anschlag) verlassen */
  x = 0;
  y = 0;
  readonly limit = { lo: -12, hi: SIZE + 11 };
  penDown = false;
  /** Farbindex in COLORS */
  color = 0;
  warning = false;
  /** Pixel der Zeichenfläche (Zeile y·80 + x): 0 = leer, 1–4 = Farbe + 1 */
  readonly grid = new Uint8Array(SIZE * SIZE);
  /** Erhöht sich bei jeder Änderung der Zeichnung */
  rev = 0;
  #prev = 0xff;
  /** Zuletzt gesehene Pegel (nur zur Anzeige) */
  pins = 0xff;
  setPins([p = 0xff]: readonly number[]) {
    const prev = this.#prev;
    this.#prev = p;
    this.pins = p;
    this.color = bit(p, 5) ? (bit(p, 6) ? 3 : 1) : bit(p, 6) ? 2 : 0;
    if (bit(p, 7)) { this.reset(); this.penDown = bit(p, 4); return; }
    const rise = (b: number) => !bit(prev, b) && bit(p, b);
    const down = bit(p, 4);
    const was = this.penDown;
    this.penDown = down;
    let dx = 0, dy = 0;
    if (rise(0)) dx++;
    if (rise(1)) dx--;
    if (rise(2)) dy++;
    if (rise(3)) dy--;
    if (dx || dy) {
      this.x = clamp(this.x + dx, this.limit.lo, this.limit.hi);
      this.y = clamp(this.y + dy, this.limit.lo, this.limit.hi);
      if (this.outside) this.warning = true;
    }
    if (down && (dx || dy || !was)) this.#plot();
  }
  get outside() { return this.x < 0 || this.y < 0 || this.x >= SIZE || this.y >= SIZE; }
  #plot() {
    if (this.outside) return;
    this.grid[this.y * SIZE + this.x] = this.color + 1;
    this.rev++;
  }
  reset() {
    const dirty = this.x !== 0 || this.y !== 0 || this.warning || this.grid.some((v) => v !== 0);
    this.x = 0; this.y = 0; this.warning = false;
    this.grid.fill(0);
    if (dirty) this.rev++;
  }
  drive() { return 0xff; }
  step() {}
}
