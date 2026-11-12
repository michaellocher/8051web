/** Codelineal: Schlitten mit vier Lichtschranken über Dual- oder Gray-Codelineal (reine Logik, kein DOM). */
import { bit, clamp, move, type PortLogic } from './b1-common.ts';

export const toGray = (n: number) => n ^ (n >> 1);
export const fromGray = (g: number) => { let n = g; for (let s = g >> 1; s; s >>= 1) n ^= s; return n; };

/**
 * 16 Felder (Positionen 0–15), 4 Spuren. D0–D3 = Lichtschranken der Spuren 0–3 (Eingänge, 1 = Spur hell),
 * D4/D5 Motor (10 rechts, 01 links, gleiche Pegel = Halt; Ausgänge). Spur 0 liegt oben im Bild und ist das niedrigste Bit.
 * „Real“: Der Abtastschlitten steht leicht schräg, jede Spur wird um einen Betrag versetzt abgetastet:
 * beim Dualcodelineal entstehen an Feldgrenzen Abtastfehler, beim Gray-Code höchstens der Nachbarwert.
 */
export class CodelinealLogic implements PortLogic {
  readonly cells = 16;
  /** Position des Abtastschlittens in Feldern (0 ≤ pos < 16) */
  pos = 0.5;
  gray = true;
  real = false;
  readonly speed = 2.5; // Felder/s
  /** Versatz der Lichtschranken je Spur in Feldern (nur „real“; linear, Schlitten steht schräg) */
  readonly offsets: readonly number[] = [-0.225, -0.075, 0.075, 0.225];
  m4 = false;
  m5 = false;
  setPins([p = 0xff]: readonly number[]) { this.m4 = bit(p, 4); this.m5 = bit(p, 5); }
  setPos(p: number) { this.pos = clamp(p, 0, this.cells - 1e-3); }
  get cell() { return Math.floor(this.pos); }
  /** Das Feld, das die Lichtschranke der Spur i sieht */
  cellOfTrack(i: number) { return Math.floor(clamp(this.pos + (this.real ? this.offsets[i]! : 0), 0, this.cells - 1e-3)); }
  /** Wert der vier Lichtschranken (D3..D0) */
  get code(): number {
    let v = 0;
    for (let i = 0; i < 4; i++) {
      const c = this.cellOfTrack(i);
      v |= (((this.gray ? toGray(c) : c) >> i) & 1) << i;
    }
    return v;
  }
  /** Gray-Wert zurück in eine Feldnummer gewandelt (wie ein Programm es täte) */
  get decoded() { return this.gray ? fromGray(this.code) : this.code; }
  drive() { return 0xf0 | this.code; }
  step(dt: number) {
    const dir = this.m4 === this.m5 ? 0 : this.m4 ? 1 : -1;
    this.pos = move(this.pos, dir, this.speed, dt, 0, this.cells - 1e-3).v;
  }
}
