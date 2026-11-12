/**
 * Sieben-Segment-Anzeige: Vier BCD-Schalter liefern eine Zahl, das Programm soll sie decodieren und die
 * Segmente einer Anzeige ansteuern.
 *
 * Ax.0 A  Segment oben                         Ex.0 S1  BCD-Schalter Wert 1
 * Ax.1 B  Segment oben rechts                  Ex.1 S2  BCD-Schalter Wert 2
 * Ax.2 C  Segment unten rechts                 Ex.2 S3  BCD-Schalter Wert 4
 * Ax.3 D  Segment unten                        Ex.3 S4  BCD-Schalter Wert 8
 * Ax.4 E  Segment unten links
 * Ax.5 F  Segment oben links
 * Ax.6 G  Segment Mitte
 *
 * Ax = 1 → Segment leuchtet (Anzeige mit gemeinsamer Masse). Schalter rasten (Ex = 1 → Schalter oben).
 * Werte 10–15 werden als A, b, C, d, E, F erkannt.
 */
import type { ModelLogic } from '../logic.ts';

/** Segmentmuster (Bit 0 = a … Bit 6 = g) der Zeichen 0–F */
export const GLYPHS = [0x3f, 0x06, 0x5b, 0x4f, 0x66, 0x6d, 0x7d, 0x07, 0x7f, 0x6f, 0x77, 0x7c, 0x39, 0x5e, 0x79, 0x71] as const;
export const CHARS = '0123456789AbCdEF';

export class SiebenLogic implements ModelLogic {
  /** Schalterstellung 0..15 */
  value = 0;
  seg = 0;

  get ex() { return this.value & 0x0f; }
  /** erkanntes Zeichen der Anzeige, '' = dunkel, '?' = kein gültiges Zeichen */
  get shown() {
    if (this.seg === 0) return '';
    const i = GLYPHS.indexOf(this.seg as (typeof GLYPHS)[number]);
    return i < 0 ? '?' : CHARS[i]!;
  }
  get matches() { return this.shown === CHARS[this.value]; }
  get status() {
    const sw = `Schalter ${this.value.toString(2).padStart(4, '0')} = ${CHARS[this.value]}`;
    const s = this.shown;
    if (s === '') return `${sw} · Anzeige dunkel`;
    if (s === '?') return `${sw} · Anzeige zeigt kein gültiges Zeichen`;
    return `${sw} · Anzeige zeigt ${s}${this.matches ? ' – stimmt' : ' – stimmt nicht!'}`;
  }

  step(ax: number) { this.seg = ax & 0x7f; }

  input(name: string, down: boolean) {
    const m = /^s([1-4])$/.exec(name);
    if (m) {
      const b = Number(m[1]) - 1;
      this.value = down ? this.value | (1 << b) : this.value & ~(1 << b);
    }
    if (name === 'set') this.value = down ? 0x0f : 0;
  }

  reset() { this.value = 0; this.seg = 0; }
}
