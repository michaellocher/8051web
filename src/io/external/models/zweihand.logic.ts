/**
 * Zweihandverriegelung einer Presse: Der Pressenstempel fährt nur nach unten, solange K1 an ist,
 * und fährt bei K1 aus zurück nach oben. Zum Auslösen müssen beide Taster innerhalb von 0,5 s
 * gedrückt werden und während des Hubs gedrückt bleiben, sonst besteht Verletzungsgefahr.
 * Mit den Schaltern „festgeklebt" lässt sich ein Taster dauerhaft überbrücken (Manipulation).
 *
 * Ax.0 K1  Pressenmotor (Stempel ab)            Ex.0 S1  Taster links
 *                                               Ex.1 S2  Taster rechts
 *                                               Ex.2 B1  Stempel unten (Hubende)
 *                                               Ex.3 B2  Stempel oben
 */
import { bit, clamp01, pack, type ModelLogic } from '../logic.ts';
import { Notice } from './p2.util.ts';

const DOWN = 0.65, UP = 0.8, WINDOW = 0.5;

export class ZweihandLogic implements ModelLogic {
  /** Stempelposition 0 (oben) … 1 (unten) */
  ram = 0;
  k1 = false;
  s1 = false;
  s2 = false;
  tape1 = false;
  tape2 = false;
  hazards = 0;
  pressed = 0;
  clock = 0;
  #t1 = -99;
  #t2 = -99;
  #prev1 = false;
  #prev2 = false;
  #inHazard = false;
  #didPress = false;
  readonly note = new Notice();

  get p1() { return this.s1 || this.tape1; }
  get p2() { return this.s2 || this.tape2; }
  get ex() { return pack([this.p1, this.p2, this.ram >= 0.98, this.ram <= 0.02]); }
  get status() { return this.note.text; }
  /** beide Hände korrekt am Taster (Zeitfenster eingehalten)? */
  get twoHandOk() { return this.p1 && this.p2 && Math.abs(this.#t1 - this.#t2) <= WINDOW; }

  step(ax: number, dt: number) {
    this.clock += dt;
    this.note.tick(dt);
    if (this.p1 && !this.#prev1) this.#t1 = this.clock;
    if (this.p2 && !this.#prev2) this.#t2 = this.clock;
    this.#prev1 = this.p1; this.#prev2 = this.p2;
    this.k1 = bit(ax, 0);
    if (this.k1) {
      if (!this.twoHandOk && this.ram < 0.98) {
        if (!this.#inHazard) {
          this.#inHazard = true; this.hazards++;
          const late = this.p1 && this.p2;
          this.note.say(late ? 'GEFAHR: Zeitfenster von 0,5 s überschritten, Taster überbrückt?' : 'GEFAHR: Presse läuft, obwohl nicht beide Taster gedrückt sind!', 6);
        }
      }
      this.ram = clamp01(this.ram + DOWN * dt);
    } else {
      this.#inHazard = false;
      this.ram = clamp01(this.ram - UP * dt);
    }
    if (this.ram >= 0.98 && !this.#didPress) { this.#didPress = true; this.pressed++; this.note.say(`Werkstück gepresst (${this.pressed}).`, 3); }
    if (this.ram < 0.3) this.#didPress = false;
  }

  input(name: string, down: boolean) {
    if (name === 's1') this.s1 = down;
    if (name === 's2') this.s2 = down;
    if (name === 'tape1') this.tape1 = down;
    if (name === 'tape2') this.tape2 = down;
  }

  reset() {
    this.ram = 0; this.hazards = 0; this.pressed = 0; this.#inHazard = false; this.#didPress = false; this.note.clear();
  }
}
