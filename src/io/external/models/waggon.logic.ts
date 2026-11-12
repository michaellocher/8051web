/**
 * Waggonbeladung (Modellvariante A, Schließer): Ein Silo mit Schüttgut belädt über eine Zellenradschleuse und eine
 * pneumatische Förderleitung einen Waggon. Reihenfolge: P1 (Fluidisierung im Silokonus, sonst Brückenbildung) und
 * P2 (Fördergebläse) zuerst, dann P3 (Zellenradschleuse). P3 ohne Gebläse verstopft die Leitung. Ist der Waggon
 * voll (S4), muss P3 sofort aus; das Gebläse läuft noch kurz nach, damit die Leitung frei wird.
 * Waggons werden mit S6 (Leerwaggon einfahren) und S7 (Vollwaggon ausfahren) von Hand bewegt; das Silo füllt S8.
 *
 * Ax.0 P1  Fluidisierung Silokonus                 Ex.0 S1  Taster Start
 * Ax.1 P2  Fördergebläse                           Ex.1 S2  Silo nicht leer (Mindeststand)
 * Ax.2 P3  Zellenradschleuse (Dosierung)           Ex.2 S3  Silo voll
 *                                                  Ex.3 S4  Waggon voll
 *                                                  Ex.4 S5  Waggon in Ladeposition
 *                                                  Ex.5 S6  Taster Leerwaggon einfahren (gehalten)
 *                                                  Ex.6 S7  Taster Vollwaggon ausfahren (gehalten)
 *                                                  Ex.7 S8  Taster Silo füllen (gehalten)
 */
import { Motor, bit, clamp01, pack, type ModelLogic } from '../logic.ts';
import { Notice } from './p2.util.ts';

const FLOW = 0.06, WAGON_CAP = 0.4, MOVE = 0.4;

export class WaggonLogic implements ModelLogic {
  silo = 0.7;
  /** Waggonposition: −1 wartet links, 0 = unter dem Auslauf, 1 = ausgefahren */
  wx = 0;
  fill = 0;
  s1 = false; s6 = false; s7 = false; s8 = false;
  readonly p1 = new Motor(0.5);
  readonly p2 = new Motor(0.8);
  readonly p3 = new Motor(0.3);
  clogged = false;
  /** verschüttetes Material, Waggons ausgefahren (davon unvollständig), Überläufe */
  spilled = 0;
  delivered = 0;
  underfilled = 0;
  overflows = 0;
  flowing = false;
  readonly note = new Notice();
  #clearT = 0;

  get inPosition() { return Math.abs(this.wx) < 0.03; }
  get ex() {
    return pack([this.s1, this.silo > 0.1, this.silo >= 0.95, this.inPosition && this.fill >= 0.9, this.inPosition, this.s6, this.s7, this.s8]);
  }
  get status() { return this.note.text; }

  step(ax: number, dt: number) {
    this.note.tick(dt);
    this.p1.step(bit(ax, 0), dt); this.p2.step(bit(ax, 1), dt); this.p3.step(bit(ax, 2), dt);
    // Waggon bewegen
    if (this.s6 && this.wx < 0) this.wx = Math.min(0, this.wx + MOVE * dt);
    if (this.s7 && this.wx >= -0.001 && this.wx < 1) {
      this.wx += MOVE * dt;
      if (this.wx >= 1) {
        this.delivered++;
        if (this.fill < 0.85) { this.underfilled++; this.note.say('Waggon nur teilweise beladen ausgefahren!', 4); }
        this.wx = -1; this.fill = 0;
      }
    }
    if (this.s8) this.silo = clamp01(this.silo + 0.2 * dt);
    // Förderung
    const p3 = this.p3.speed > 0.5;
    if (this.clogged) {
      if (!p3 && this.p2.running) { this.#clearT += dt; if (this.#clearT > 1.5) { this.clogged = false; this.#clearT = 0; } } else this.#clearT = 0;
    } else if (p3 && this.silo > 0 && !this.p2.running) {
      this.clogged = true;
      this.note.say('Förderleitung verstopft: Zellenradschleuse P3 ohne Gebläse P2! (P3 aus, P2 zum Freiblasen)', 6);
    }
    let flow = 0;
    if (p3 && this.silo > 0 && !this.clogged) {
      if (this.p1.speed < 0.5) { this.note.say('Brückenbildung im Silo: ohne Fluidisierung P1 fließt kein Material nach.', 2); }
      else flow = FLOW * this.p3.speed;
    }
    this.flowing = flow > 0;
    if (flow > 0) {
      this.silo = Math.max(0, this.silo - flow * dt);
      if (this.silo === 0) this.note.say('Silo leer: Schleuse läuft leer!', 3);
      if (this.inPosition && this.fill < 1) this.fill = Math.min(1, this.fill + (flow / WAGON_CAP) * dt);
      else {
        this.spilled += flow * dt;
        this.note.say(this.inPosition ? 'Waggon läuft über: Material fällt daneben!' : 'Kein Waggon unter dem Auslauf: Material fällt aufs Gleis!', 3);
        if (this.inPosition) this.overflows++;
      }
    }
  }

  input(name: string, down: boolean) {
    if (name === 's1') this.s1 = down;
    if (name === 's6') this.s6 = down;
    if (name === 's7') this.s7 = down;
    if (name === 's8') this.s8 = down;
  }

  reset() {
    this.silo = 0.7; this.wx = 0; this.fill = 0; this.clogged = false; this.spilled = 0; this.delivered = 0;
    this.underfilled = 0; this.overflows = 0; this.p1.speed = 0; this.p2.speed = 0; this.p3.speed = 0; this.flowing = false;
    this.#clearT = 0; this.note.clear();
  }
}
