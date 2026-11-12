/**
 * Garagentorsteuerung (Rolltor): Schlüsselschalter S1 (außen) und Handtaster S2 (innen) wirken als Impulstaster:
 * Tor zu → öffnen, Tor offen → schließen, während der Fahrt → anhalten. Die Lichtschranke Se3 muss beim
 * Schließen das Tor stoppen und wieder öffnen lassen. Mit dem Schalter S3 wird ein Hindernis in die Lichtschranke gelegt.
 *
 * Ax.0 M1  Motor Tor auf                        Ex.0 S1  Schlüsselschalter (außen)
 * Ax.1 M2  Motor Tor ab                         Ex.1 S2  Handtaster (innen)
 * Ax.2 H1  Warnleuchte                          Ex.2 Se1 Endlage oben (Tor offen)
 *                                               Ex.3 Se2 Endlage unten (Tor zu)
 *                                               Ex.4 Se3 Lichtschranke unterbrochen (Hindernis)
 */
import { bit, pack, type ModelLogic } from '../logic.ts';
import { Notice } from './p2.util.ts';

const SPEED = 1 / 6;

export class GaragentorLogic implements ModelLogic {
  /** 0 = geschlossen … 1 = offen */
  pos = 0;
  dir = 0;
  s1 = false;
  s2 = false;
  obstacle = false;
  warn = false;
  crushed = 0;
  clock = 0;
  readonly note = new Notice();
  #crushT = 0;
  #crushed = false;
  #blockT = 0;

  get ex() { return pack([this.s1, this.s2, this.pos >= 0.98, this.pos <= 0.02, this.obstacle]); }
  get status() { return this.note.text; }

  step(ax: number, dt: number) {
    this.clock += dt;
    this.note.tick(dt);
    const up = bit(ax, 0), down = bit(ax, 1);
    this.warn = bit(ax, 2);
    this.dir = up && down ? 0 : up ? 1 : down ? -1 : 0;
    if (up && down) this.note.say('Kurzschluss: M1 und M2 gleichzeitig!', 5);
    const np = this.pos + this.dir * SPEED * dt;
    if (np < 0 || np > 1) {
      this.#blockT += dt;
      if (this.#blockT > 0.5) this.note.say('Motor läuft gegen die Endlage – Endschalter nicht ausgewertet!', 4);
    } else this.#blockT = 0;
    this.pos = Math.min(1, Math.max(0, np));
    if (this.dir < 0 && this.obstacle && this.pos > 0.02) {
      this.#crushT += dt;
      if (this.#crushT > 0.3 && !this.#crushed) { this.#crushed = true; this.crushed++; this.note.say('GEFAHR: Hindernis wird vom Tor eingeklemmt!', 8); }
    } else { this.#crushT = 0; if (this.dir >= 0) this.#crushed = false; }
  }

  input(name: string, down: boolean) {
    if (name === 's1') this.s1 = down;
    if (name === 's2') this.s2 = down;
    if (name === 'obstacle') this.obstacle = down;
  }

  reset() { this.pos = 0; this.dir = 0; this.crushed = 0; this.#crushT = 0; this.#crushed = false; this.#blockT = 0; this.obstacle = false; this.note.clear(); }
}
