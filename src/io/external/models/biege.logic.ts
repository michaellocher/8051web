/**
 * Biegevorrichtung: Ein Blechstreifen liegt auf dem Biegewerkzeug. Zylinder A (Niederhalter) spannt ihn,
 * Zylinder B (Biegestempel) biegt den überstehenden Rand nach unten, Zylinder C (Auswerfer, von rechts)
 * schiebt das fertige Teil vom Werkzeug. Alle drei Zylinder sind doppelt wirkend mit Impulsventil.
 *
 * Ax.0 Y1  A ausfahren (Niederhalter ab)        Ex.0 S0  Taster START
 * Ax.1 Y2  A einfahren (Niederhalter auf)       Ex.1 S1  Taster STOP
 * Ax.2 Y3  B ausfahren (Stempel biegt)          Ex.2 B1  A eingefahren (oben)
 * Ax.3 Y4  B einfahren                          Ex.3 B2  A ausgefahren (unten)
 * Ax.4 Y5  C ausfahren (Auswerfer)              Ex.4 B3  B eingefahren (oben)
 * Ax.5 Y6  C einfahren                          Ex.5 B4  B ausgefahren (unten)
 *                                               Ex.6 B5  C eingefahren
 *                                               Ex.7 B6  C ausgefahren
 *
 * Alle Sensoren sind Schließer (1 = betätigt). Das Teil muss beim Biegen gespannt sein; erst nach dem
 * Einfahren von A kann C es auswerfen. Mit dem Knopf „Reset“ wird ein neuer Blechstreifen eingelegt.
 */
import { Cylinder, MemoryValve, bit, pack, type ModelLogic } from '../logic.ts';
import { Notice } from './p2.util.ts';

export type BlechState = 'none' | 'raw' | 'ruined';

/** Ab dieser Stempelposition berührt B das Blech (Leerhub davor) */
export const B_CONTACT = 0.53;
/** Verschiebeweg des Auswerfers, bis das Teil herunterfällt (Zeichenpixel pro Hub = 155) */
const C_TOUCH = 0.2;

export class BiegeLogic implements ModelLogic {
  readonly a = new Cylinder(0.8);
  readonly b = new Cylinder(0.55);
  readonly c = new Cylinder(0.8);
  readonly va = new MemoryValve();
  readonly vb = new MemoryValve();
  readonly vc = new MemoryValve();
  blech: BlechState = 'raw';
  /** Biegefortschritt 0 (flach) … 1 (90°) */
  bend = 0;
  /** Verschiebung des Blechs durch den Auswerfer 0..1 */
  push = 0;
  start = false;
  stop = false;
  bentCount = 0;
  ruinedCount = 0;
  readonly note = new Notice();
  #fault = '';

  get ex() {
    return pack([this.start, this.stop, this.a.retracted, this.a.extended, this.b.retracted, this.b.extended, this.c.retracted, this.c.extended]);
  }
  get bent() { return this.bend >= 0.95; }
  get status() { return this.#fault || this.note.text; }

  #ruin(msg: string) {
    this.blech = 'ruined'; this.ruinedCount++; this.#fault = `Störung: ${msg}`;
  }

  step(ax: number, dt: number) {
    this.note.tick(dt);
    const aBefore = this.a.pos;
    this.a.move(this.va.update(bit(ax, 0), bit(ax, 1)), dt);
    this.b.move(this.vb.update(bit(ax, 2), bit(ax, 3)), dt);
    let cDir: number = this.vc.update(bit(ax, 4), bit(ax, 5));
    // Auswerfer läuft gegen das gespannte Werkstück
    if (cDir > 0 && this.blech !== 'none' && this.a.pos > 0.5 && this.c.pos >= C_TOUCH) {
      cDir = 0;
      this.note.say('Störung: Auswerfer C blockiert – Werkstück ist noch gespannt (A ausgefahren)!', 6);
    }
    this.c.move(cDir, dt);

    if (this.blech === 'raw') {
      // Niederhalter fährt weg, während der Stempel noch biegt
      if (this.a.pos < aBefore && this.a.pos < 0.9 && this.b.pos > B_CONTACT && this.bend > 0) {
        this.#ruin('Niederhalter A hebt ab, während B biegt – Werkstück verformt!');
      } else if (this.b.pos > B_CONTACT) {
        if (!this.a.extended && this.bend === 0) this.#ruin('Werkstück nicht gespannt – Blech verrutscht, Biegung unbrauchbar!');
        else this.bend = Math.max(this.bend, Math.min(1, (this.b.pos - B_CONTACT) / (1 - B_CONTACT)));
      }
      if (this.blech === 'raw' && this.b.retracted && this.bend > 0 && !this.bent) this.note.say('Biegung unvollständig: Stempel B war nicht ganz unten.', 5);
    }
    // Auswerfer schiebt das Teil seitlich vom Werkzeug
    if (this.blech !== 'none') {
      this.push = Math.max(this.push, Math.max(0, this.c.pos - C_TOUCH) / (1 - C_TOUCH));
      if (this.push >= 0.9) {
        if (this.blech === 'raw' && this.bent) { this.bentCount++; this.note.say(`Werkstück gebogen und ausgeworfen (${this.bentCount}).`, 5); }
        else if (this.blech === 'raw') { this.ruinedCount++; this.note.say('Rohling ohne vollständige Biegung ausgeworfen!', 5); }
        this.blech = 'none'; this.#fault = '';
      }
    }
  }

  input(name: string, down: boolean) {
    if (name === 'start') this.start = down;
    if (name === 'stop') this.stop = down;
    if (name === 'reset' && down) {
      if (!this.c.retracted || !this.a.retracted) { this.note.say('Neues Blech erst einlegen, wenn A und C eingefahren sind.', 4); return; }
      this.blech = 'raw'; this.bend = 0; this.push = 0; this.#fault = ''; this.note.say('Neues Blech eingelegt.', 3);
    }
  }

  reset() {
    this.a.pos = 0; this.b.pos = 0; this.c.pos = 0;
    this.va.dir = -1; this.vb.dir = -1; this.vc.dir = -1;
    this.blech = 'raw'; this.bend = 0; this.push = 0; this.bentCount = 0; this.ruinedCount = 0; this.#fault = ''; this.note.clear();
  }
}
