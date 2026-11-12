/**
 * Bohrvorrichtung: Werkstück wird von Zylinder A gespannt, Zylinder B senkt die Bohrmaschine ab.
 *
 * Ax.0 Y1  Zylinder A ausfahren (spannen)      Ex.0 S1  Taster START
 * Ax.1 Y2  Zylinder A einfahren (lösen)        Ex.1 S2  Taster RESET
 * Ax.2 Y3  Zylinder B ausfahren (Bohrer ab)    Ex.2 B1  Zylinder A eingefahren
 * Ax.3 Y4  Zylinder B einfahren (Bohrer auf)   Ex.3 B2  Zylinder A ausgefahren (gespannt)
 * Ax.4 M1  Bohrmotor                            Ex.4 B3  Bohrer oben
 *                                               Ex.5 B4  Bohrer unten
 *                                               Ex.6 B5  Werkstück vorhanden
 */
import { Cylinder, MemoryValve, Motor, bit, pack, type ModelLogic } from '../logic.ts';

export type Piece = 'none' | 'raw' | 'drilled' | 'broken';

export class BohrLogic implements ModelLogic {
  readonly a = new Cylinder(0.9);
  readonly b = new Cylinder(0.45);
  readonly va = new MemoryValve();
  readonly vb = new MemoryValve();
  readonly motor = new Motor(0.25);
  piece: Piece = 'raw';
  /** Bohrfortschritt 0..1 */
  depth = 0;
  start = false;
  resetBtn = false;
  status = '';
  drilledCount = 0;

  get ex() {
    return pack([this.start, this.resetBtn, this.a.retracted, this.a.extended, this.b.retracted, this.b.extended, this.piece !== 'none']);
  }

  step(ax: number, dt: number) {
    this.a.move(this.va.update(bit(ax, 0), bit(ax, 1)), dt);
    this.b.move(this.vb.update(bit(ax, 2), bit(ax, 3)), dt);
    this.motor.step(bit(ax, 4), dt);
    // Bohrer taucht ins Werkstück ein (ab 60 % Hub)
    if (this.b.pos > 0.6 && this.piece === 'raw') {
      if (!this.motor.running) { this.piece = 'broken'; this.status = 'Störung: Bohrer ohne Drehung eingetaucht – Bohrer gebrochen!'; }
      else if (!this.a.extended) { this.piece = 'broken'; this.status = 'Störung: Werkstück nicht gespannt – Werkstück verrutscht!'; }
      else this.depth = Math.max(this.depth, (this.b.pos - 0.6) / 0.4);
    }
    if (this.piece === 'raw' && this.depth >= 0.9 && this.b.retracted) {
      this.piece = 'drilled';
      this.drilledCount++;
      this.status = `Werkstück gebohrt (${this.drilledCount}).`;
    }
  }

  input(name: string, down: boolean) {
    if (name === 'start') this.start = down;
    if (name === 'reset') this.resetBtn = down;
    if (name === 'piece' && down) {
      if (!this.a.retracted) { this.status = 'Werkstück erst wechseln, wenn Zylinder A eingefahren ist.'; return; }
      this.piece = 'raw'; this.depth = 0; this.status = 'Neues Werkstück eingelegt.';
    }
  }

  reset() {
    this.a.pos = 0; this.b.pos = 0; this.va.dir = -1; this.vb.dir = -1;
    this.motor.speed = 0; this.piece = 'raw'; this.depth = 0; this.status = ''; this.drilledCount = 0;
  }
}
