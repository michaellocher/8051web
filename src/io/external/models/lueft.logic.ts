/**
 * Lüftungsüberwachung: Ein Tunnel wird von vier Strahlventilatoren belüftet, jeder hat einen
 * Drehzahlwächter. Die Verkehrsampel A1 am Tunnelportal soll je nach Zahl der laufenden Lüfter schalten:
 * ≥ 3 Lüfter grün, genau 2 gelb, ≤ 1 rot (Tunnel sperren). Fehler an einem Lüfter: Blitz-Symbol.
 *
 * Ax.0 A1 Ampel rot           Ex.0 S1 Lüfter 1 dreht (1)
 * Ax.1 A1 Ampel gelb          Ex.1 S2 Lüfter 2 dreht
 * Ax.2 A1 Ampel grün          Ex.2 S3 Lüfter 3 dreht
 *                              Ex.3 S4 Lüfter 4 dreht
 */
import { Motor, pack, type ModelLogic } from '../logic.ts';
import { hold } from './p1.util.ts';

export class LueftLogic implements ModelLogic {
  readonly fans = [0, 1, 2, 3].map(() => { const m = new Motor(0.6); m.speed = 1; return m; });
  readonly failed = [false, false, false, false];
  ax = 0;
  #wrong = 0;

  get running() { return this.fans.filter((f) => f.running).length; }
  /** Sollzustand der Ampel als Bitmaske (1 rot, 2 gelb, 4 grün) */
  get expectedSignal() { const n = this.running; return n >= 3 ? 4 : n === 2 ? 2 : 1; }
  get ex() { return pack(this.fans.map((f) => f.running)); }

  step(ax: number, dt: number) {
    this.ax = ax;
    this.fans.forEach((f, i) => f.step(!this.failed[i], dt));
    this.#wrong = hold(this.#wrong, (ax & 7) !== this.expectedSignal, dt);
  }

  /** f1…f4: Störung an Lüfter umschalten (bei down) */
  input(name: string, down: boolean) {
    const m = /^f([1-4])$/.exec(name);
    if (m && down) this.failed[Number(m[1]) - 1] = !this.failed[Number(m[1]) - 1];
  }

  get status() {
    const sig = ['', 'rot', 'gelb', '', 'grün'][this.expectedSignal]!;
    if (this.#wrong > 1) return `${this.running} Lüfter laufen – Ampel müsste ${sig} zeigen!`;
    return `${this.running} von 4 Lüftern laufen – Ampel ${sig}`;
  }

  reset() { this.failed.fill(false); this.fans.forEach((f) => { f.speed = 1; }); this.ax = 0; this.#wrong = 0; }
}
