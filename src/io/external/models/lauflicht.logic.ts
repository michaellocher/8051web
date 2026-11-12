/**
 * Verkehrslauflicht: sechs Warnleuchten H1–H6 sollen der Reihe nach aufleuchten (Lauflicht von H1 nach H6).
 * Das Bedienfeld wählt EIN/AUS und eine von drei Geschwindigkeiten.
 *
 * Ax.0–Ax.5 H1–H6  Warnleuchten                 Ex.0 S0  EIN/AUS-Schalter (EIN = 1)
 *                                               Ex.1 F1  Geschwindigkeit langsam gewählt
 *                                               Ex.2 F2  Geschwindigkeit mittel gewählt
 *                                               Ex.3 F3  Geschwindigkeit schnell gewählt
 * (genau eine der Leitungen Ex.1–3 führt 1)
 */
import { bit, pack, type ModelLogic } from '../logic.ts';

export class LauflichtLogic implements ModelLogic {
  on = false;
  /** 1 = langsam … 3 = schnell */
  speed = 2;
  lamps = 0;
  clock = 0;
  steps = 0;
  badSteps = 0;
  /** Zeit zwischen den letzten beiden Schritten (s) */
  interval = 0;
  #last = -1;
  #lastT = 0;

  get ex() { return pack([this.on, this.speed === 1, this.speed === 2, this.speed === 3]); }
  get status() {
    if (this.badSteps > 0) return 'Reihenfolge der Leuchten stimmt nicht.';
    return this.steps > 1 ? `Lauflicht: ${Math.round(this.interval * 1000)} ms pro Schritt` : '';
  }

  step(ax: number, dt: number) {
    this.clock += dt;
    this.lamps = ax & 0x3f;
    const lit = [0, 1, 2, 3, 4, 5].filter((i) => bit(ax, i));
    if (lit.length === 1 && lit[0] !== this.#last) {
      const i = lit[0]!;
      if (this.#last >= 0) {
        if (i === (this.#last + 1) % 6) { this.steps++; this.interval = this.clock - this.#lastT; } else this.badSteps++;
      }
      this.#last = i; this.#lastT = this.clock;
    }
  }

  input(name: string, down: boolean) {
    if (!down) return;
    if (name === 'on') this.on = true;
    if (name === 'off') this.on = false;
    if (name === 'slower') this.speed = Math.max(1, this.speed - 1);
    if (name === 'faster') this.speed = Math.min(3, this.speed + 1);
  }

  reset() { this.on = false; this.speed = 2; this.lamps = 0; this.steps = 0; this.badSteps = 0; this.interval = 0; this.#last = -1; }
}
