/**
 * Einfache Bohrvorrichtung: Zylinder Z1 fährt das Werkstück auf dem Schlitten unter den Bohrer,
 * Zylinder Z2 senkt die Bohrmaschine M1 ab. Es gibt keine Spannvorrichtung wie bei der Bohrvorrichtung
 * aus Modellpaket 1 – dafür sind Z1 und Z2 doppelt wirkend mit Impulsventilen.
 *
 * Ax.0 Z1 vor  (Schlitten unter den Bohrer)     Ex.0 S1    Taster START
 * Ax.1 Z1 zurück                                Ex.1 S2    Taster RESET (Bohrer wechseln, Störung quittieren)
 * Ax.2 Z2 ab   (Bohrer senken)                  Ex.2 GIS1  Z1 hinten (Ausgangslage)
 * Ax.3 Z2 auf                                   Ex.3 GIS2  Z1 vorn (Werkstück unter dem Bohrer)
 * Ax.4 M1  Bohrmotor                            Ex.4 GIS3  Z2 oben
 *                                               Ex.5 GIS4  Z2 unten
 *
 * Alle Sensoren sind Schließer (1 = betätigt). Der Bohrer bricht, wenn er ohne Drehung eintaucht,
 * wenn Z1 fährt, während er im Werkstück steckt, oder wenn er auf den Schlitten trifft.
 */
import { Cylinder, MemoryValve, Motor, bit, pack, type ModelLogic } from '../logic.ts';
import { Notice } from './p2.util.ts';

export type Piece2 = 'none' | 'raw' | 'drilled';

/** Z2-Position, ab der die Bohrerspitze das Werkstück berührt */
export const Z2_CONTACT = 110 / 140;

export class Bohr2Logic implements ModelLogic {
  readonly z1 = new Cylinder(0.5);
  readonly z2 = new Cylinder(0.6);
  readonly v1 = new MemoryValve();
  readonly v2 = new MemoryValve();
  readonly motor = new Motor(0.25);
  piece: Piece2 = 'raw';
  /** Bohrtiefe 0..1 */
  depth = 0;
  bitBroken = false;
  drilledCount = 0;
  start = false;
  resetBtn = false;
  readonly note = new Notice();
  #fault = '';

  get ex() { return pack([this.start, this.resetBtn, this.z1.retracted, this.z1.extended, this.z2.retracted, this.z2.extended]); }
  get status() { return this.#fault || this.note.text; }
  get faulted() { return this.#fault !== ''; }

  #breakBit(msg: string) { this.bitBroken = true; this.#fault = `Störung: ${msg} – Bohrer gebrochen! RESET wechselt den Bohrer.`; }

  step(ax: number, dt: number) {
    this.note.tick(dt);
    const z1Before = this.z1.pos;
    this.motor.step(bit(ax, 4) && !this.bitBroken, dt);
    this.z2.move(this.v2.update(bit(ax, 2), bit(ax, 3)), dt);
    this.z1.move(this.v1.update(bit(ax, 0), bit(ax, 1)), dt);
    if (!this.bitBroken && this.z2.pos > Z2_CONTACT - 0.1 && this.z1.pos !== z1Before) {
      this.#breakBit('Schlitten Z1 fährt gegen den abgesenkten Bohrer');
    }
    // Bohrer taucht ein
    if (!this.bitBroken && this.z2.pos > Z2_CONTACT) {
      if (!this.z1.extended) {
        this.#breakBit('Bohrer trifft auf den Schlitten statt auf das Werkstück');
      } else if (this.piece === 'raw') {
        if (!this.motor.running) this.#breakBit('Bohrer taucht ohne Drehung ein');
        else this.depth = Math.max(this.depth, (this.z2.pos - Z2_CONTACT) / (1 - Z2_CONTACT));
      }
    }
    if (this.piece === 'raw' && this.depth >= 0.9 && this.z2.pos < Z2_CONTACT) {
      this.piece = 'drilled'; this.drilledCount++;
      this.note.say(`Werkstück gebohrt (${this.drilledCount}).`, 4);
    }
  }

  input(name: string, down: boolean) {
    if (name === 'start') this.start = down;
    if (name === 'reset') {
      this.resetBtn = down;
      if (down && this.bitBroken) { this.bitBroken = false; this.#fault = ''; this.note.say('Neuer Bohrer eingesetzt.', 3); }
    }
    if (name === 'piece' && down) {
      if (!this.z1.retracted) { this.note.say('Werkstück erst wechseln, wenn Z1 hinten steht.', 4); return; }
      this.piece = 'raw'; this.depth = 0; this.note.say('Neues Werkstück eingelegt.', 3);
    }
  }

  reset() {
    this.z1.pos = 0; this.z2.pos = 0; this.v1.dir = -1; this.v2.dir = -1; this.motor.speed = 0;
    this.piece = 'raw'; this.depth = 0; this.bitBroken = false; this.drilledCount = 0; this.#fault = ''; this.note.clear();
  }
}
