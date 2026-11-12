/**
 * Schiebetorsteuerung: Ein Motor schiebt das Tor nach rechts (öffnen) oder links (schließen).
 * Eine Lichtschranke überwacht die Durchfahrt. Wird beim Schließen ein Hindernis erkannt,
 * muss das Tor sofort stoppen bzw. wieder öffnen, sonst wird die Person eingeklemmt.
 *
 * Ax.0 H1  Meldelampe „Tor offen"               Ex.0 S1  Taster STOP
 * Ax.1 H2  Meldelampe „Tor geschlossen"         Ex.1 S2  Taster Schließen
 * Ax.2 H3  Warnleuchte (Tor in Bewegung)        Ex.2 S3  Endschalter Tor geschlossen
 * Ax.3 K1  Motor Schließen (←)                  Ex.3 S4  Taster Öffnen
 * Ax.4 K2  Motor Öffnen (→)                     Ex.4 S5  Endschalter Tor offen
 *                                               Ex.5 S6  Lichtschranke unterbrochen (Hindernis)
 */
import { bit, pack, type ModelLogic } from '../logic.ts';
import { Notice } from './p2.util.ts';

const SPEED = 0.2;

export class SchiebetorLogic implements ModelLogic {
  /** 0 = geschlossen … 1 = offen */
  pos = 0;
  dir = 0;
  stop = false;
  closeBtn = false;
  openBtn = false;
  obstacle = false;
  h1 = false;
  h2 = false;
  h3 = false;
  crushed = 0;
  readonly note = new Notice();
  #crushT = 0;
  #crushed = false;
  #blockT = 0;

  get ex() { return pack([this.stop, this.closeBtn, this.pos <= 0.02, this.openBtn, this.pos >= 0.98, this.obstacle]); }
  get status() { return this.note.text; }

  step(ax: number, dt: number) {
    this.note.tick(dt);
    this.h1 = bit(ax, 0); this.h2 = bit(ax, 1); this.h3 = bit(ax, 2);
    const closing = bit(ax, 3), opening = bit(ax, 4);
    this.dir = closing && opening ? 0 : opening ? 1 : closing ? -1 : 0;
    if (closing && opening) this.note.say('Kurzschluss: K1 und K2 gleichzeitig!', 5);
    const np = this.pos + this.dir * SPEED * dt;
    if (np < 0 || np > 1) {
      this.#blockT += dt;
      if (this.#blockT > 0.5) this.note.say('Endlage überfahren: Motor läuft gegen den Anschlag!', 4);
    } else this.#blockT = 0;
    this.pos = Math.min(1, Math.max(0, np));
    if (this.dir < 0 && this.obstacle && this.pos > 0.02) {
      this.#crushT += dt;
      if (this.#crushT > 0.3 && !this.#crushed) { this.#crushed = true; this.crushed++; this.note.say('GEFAHR: Person wird vom schließenden Tor eingeklemmt!', 8); }
    } else { this.#crushT = 0; if (this.dir >= 0) this.#crushed = false; }
  }

  input(name: string, down: boolean) {
    if (name === 'stop') this.stop = down;
    if (name === 'close') this.closeBtn = down;
    if (name === 'open') this.openBtn = down;
    if (name === 'obstacle') this.obstacle = down;
  }

  reset() { this.pos = 0; this.dir = 0; this.crushed = 0; this.#crushT = 0; this.#crushed = false; this.#blockT = 0; this.obstacle = false; this.note.clear(); }
}
