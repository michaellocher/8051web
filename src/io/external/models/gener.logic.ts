/**
 * Generatorüberwachung (Modellvariante A, ohne Drahtbruchsicherheit):
 * Vier Motoren M1–M4 (2, 3, 5, 7 kW) hängen an einem Generator. Jeder Motor wird von Hand am Motor
 * ein- und ausgeschaltet. Ein Drehzahlwächter je Motor meldet 1, solange der Motor dreht.
 * Der Generator verträgt höchstens GEN_LIMIT kW; bei Überlast soll die Warnlampe H1 leuchten.
 *
 * Ax.0 H1 Warnlampe Überlast        Ex.0 S1 Drehzahlwächter M1 (1 = dreht)
 *                                    Ex.1 S2 Drehzahlwächter M2
 *                                    Ex.2 S3 Drehzahlwächter M3
 *                                    Ex.3 S4 Drehzahlwächter M4
 */
import { Motor, bit, pack, type ModelLogic } from '../logic.ts';
import { hold } from './p1.util.ts';

export const GEN_KW = [2, 3, 5, 7] as const;
export const GEN_LIMIT = 10;

export class GenerLogic implements ModelLogic {
  readonly motors = GEN_KW.map(() => new Motor(0.5));
  /** Motorschalter (am Motor) */
  readonly on = [false, false, false, false];
  /** Drahtbruch am Drehzahlwächter: Variante A meldet dann fälschlich „steht“ (0) */
  readonly broken = [false, false, false, false];
  ax = 0;
  #wrong = 0;

  /** Leistung der tatsächlich laufenden Motoren in kW */
  get load() { return this.motors.reduce((s, m, i) => s + (m.running ? GEN_KW[i]! : 0), 0); }
  get overload() { return this.load > GEN_LIMIT; }
  get ex() { return pack(this.motors.map((m, i) => m.running && !this.broken[i])); }

  step(ax: number, dt: number) {
    this.ax = ax;
    this.motors.forEach((m, i) => m.step(this.on[i]!, dt));
    this.#wrong = hold(this.#wrong, this.overload !== bit(ax, 0), dt);
  }

  /** m1…m4: Motorschalter umlegen, wb1…wb4: Drahtbruch am Drehzahlwächter ein/aus (jeweils bei down) */
  input(name: string, down: boolean) {
    const m = /^(m|wb)([1-4])$/.exec(name);
    if (!m || !down) return;
    const i = Number(m[2]) - 1;
    const arr = m[1] === 'm' ? this.on : this.broken;
    arr[i] = !arr[i];
  }

  get status() {
    if (this.#wrong > 1) {
      return this.overload ? `Überlast (${this.load} kW > ${GEN_LIMIT} kW) – Warnlampe H1 fehlt!` : 'H1 leuchtet ohne Überlast.';
    }
    return `Generatorlast: ${this.load} kW${this.overload ? ' – Überlast' : ''}`;
  }

  reset() {
    this.on.fill(false); this.broken.fill(false);
    this.motors.forEach((m) => { m.speed = 0; });
    this.ax = 0; this.#wrong = 0;
  }
}
