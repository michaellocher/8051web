/**
 * Mehrfachschaltstellen: Ein Motor M1 soll von vier Stellen S1–S4 aus ein- und ausgeschaltet
 * werden (Wechsel-/Kreuzschaltung): Jede Betätigung irgendeines Schalters ändert den Zustand des Motors.
 *
 * Ax.0 M1 Motor            Ex.0 S1 Schalter (Wippe, Stellung 0/1)
 *                           Ex.1 S2 Schalter
 *                           Ex.2 S3 Schalter
 *                           Ex.3 S4 Schalter
 */
import { Motor, bit, pack, type ModelLogic } from '../logic.ts';

export class MfsLogic implements ModelLogic {
  readonly sw = [false, false, false, false];
  readonly motor = new Motor(0.6);
  ax = 0;
  /** Zahl der Schalterbetätigungen */
  toggles = 0;
  #lastRunning = false;
  /** Zahl der Motorstarts (für Überwachung zu häufigen Schaltens) */
  starts = 0;

  get ex() { return pack(this.sw); }
  /** Soll-Zustand einer idealen Wechselschaltung: Parität der Schalterstellungen */
  get expected() { return this.sw.filter(Boolean).length % 2 === 1; }

  step(ax: number, dt: number) {
    this.ax = ax;
    this.motor.step(bit(ax, 0), dt);
    if (this.motor.running && !this.#lastRunning) this.starts++;
    this.#lastRunning = this.motor.running;
  }

  /** s1…s4: Schalter in Stellung (down = 1). */
  input(name: string, down: boolean) {
    const m = /^s([1-4])$/.exec(name);
    if (!m) return;
    const i = Number(m[1]) - 1;
    if (this.sw[i] !== down) this.toggles++;
    this.sw[i] = down;
  }

  get status() {
    if (bit(this.ax, 0) !== this.expected && this.toggles > 0) return 'Motor-Zustand passt nicht zur Schalterstellung.';
    return this.motor.running ? 'M1 läuft' : 'M1 steht';
  }

  reset() { this.sw.fill(false); this.motor.speed = 0; this.ax = 0; this.toggles = 0; this.starts = 0; this.#lastRunning = false; }
}
