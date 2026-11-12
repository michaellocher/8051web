/**
 * Motorgruppenüberwachung: Zwei Gruppen mit je drei Motoren, jeder Motor hat einen Drehzahlwächter.
 * Fällt ein Motor aus (Blitz-Symbol am Motor = Störung ein/aus), soll die Gruppenstörlampe leuchten,
 * bis die Störung behoben und mit der Quittiertaste S0 quittiert wurde.
 *
 * Ax.0 H1 Störung Gruppe 1 (M_A1–M_C1)      Ex.0 M_A1 dreht (1)   Ex.3 M_A2 dreht
 * Ax.1 H2 Störung Gruppe 2 (M_A2–M_C2)      Ex.1 M_B1 dreht       Ex.4 M_B2 dreht
 *                                            Ex.2 M_C1 dreht       Ex.5 M_C2 dreht
 *                                            Ex.6 S0 Taster Quittieren
 */
import { Motor, bit, pack, type ModelLogic } from '../logic.ts';
import { hold } from './p1.util.ts';

export const MOTGRP_NAMES = ['M_A1', 'M_B1', 'M_C1', 'M_A2', 'M_B2', 'M_C2'] as const;

export class MotgrpLogic implements ModelLogic {
  readonly motors = MOTGRP_NAMES.map(() => { const m = new Motor(0.5); m.speed = 1; return m; });
  readonly failed = [false, false, false, false, false, false];
  quit = false;
  ax = 0;
  #silent = [0, 0];

  get ex() { return pack([...this.motors.map((m) => m.running), this.quit]); }
  /** Gruppe g (0/1) hat einen stehenden Motor */
  groupFault(g: number) { return this.motors.slice(g * 3, g * 3 + 3).some((m) => !m.running); }

  step(ax: number, dt: number) {
    this.ax = ax;
    this.motors.forEach((m, i) => m.step(!this.failed[i], dt));
    for (const g of [0, 1]) this.#silent[g] = hold(this.#silent[g]!, this.groupFault(g) && !bit(ax, g), dt);
  }

  /** f0…f5: Störung an Motor umschalten (bei down), quit: Taster S0 */
  input(name: string, down: boolean) {
    if (name === 'quit') this.quit = down;
    const m = /^f([0-5])$/.exec(name);
    if (m && down) this.failed[Number(m[1])] = !this.failed[Number(m[1])];
  }

  get status() {
    const stopped = MOTGRP_NAMES.filter((_, i) => !this.motors[i]!.running);
    if (this.#silent.some((s) => s > 1)) return `${stopped.join(', ')} steht – Störung nicht gemeldet!`;
    return stopped.length ? `Stillstand: ${stopped.join(', ')}` : 'Alle Motoren laufen';
  }

  reset() {
    this.failed.fill(false); this.motors.forEach((m) => { m.speed = 1; });
    this.quit = false; this.ax = 0; this.#silent = [0, 0];
  }
}
