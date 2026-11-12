/**
 * Hebevorrichtung: Kisten laufen auf dem unteren Band an. Zylinder A hebt sie auf die Höhe des oberen
 * Bandes, Zylinder B schiebt sie dort auf das obere Band. Beide Ventile sind federrückgestellt.
 *
 * Ax.0 Y1  Zylinder A ausfahren (Hubtisch hoch)     Ex.0 B0  Kiste am Hubtisch (Lichtschranke unten)
 * Ax.1 Y2  Zylinder B ausfahren (Kiste schieben)    Ex.1 B1  A eingefahren (unten)
 *                                                   Ex.2 B2  A ausgefahren (oben)
 *                                                   Ex.3 B3  B eingefahren
 *                                                   Ex.4 B4  B ausgefahren
 *                                                   Ex.5 S1  Taster RESET (Störung quittieren)
 *
 * Störungen: B schiebt, bevor der Hubtisch oben ist → Kiste fällt herunter; B steht im Hubweg, wenn A
 * hochfährt → Hubtisch blockiert. Sensoren und Taster sind Schließer (1 = betätigt).
 */
import { Cylinder, bit, pack, springValve, type ModelLogic } from '../logic.ts';
import { Notice } from './p2.util.ts';

export type BoxStage = 'none' | 'belt' | 'platform' | 'fallen';

export class HebeLogic implements ModelLogic {
  readonly a = new Cylinder(0.5);
  readonly b = new Cylinder(1.0);
  stage: BoxStage = 'none';
  /** Position der Kiste auf dem unteren Band 0..1 (1 = am Hubtisch) */
  s = 0;
  /** Fortschritt der Kisten auf dem oberen Band 0..1 */
  upper: number[] = [];
  done = 0;
  faults = 0;
  s1 = false;
  readonly note = new Notice();
  #fault = '';
  #spawn = 1.5;

  get faulted() { return this.#fault !== ''; }
  get status() { return this.#fault || this.note.text; }
  get ex() {
    const atLift = this.stage === 'platform' && this.a.retracted;
    return pack([atLift, this.a.retracted, this.a.extended, this.b.retracted, this.b.extended, this.s1]);
  }

  #fail(msg: string) { this.faults++; this.#fault = `Störung: ${msg}`; }

  step(ax: number, dt: number) {
    this.note.tick(dt);
    const aBefore = this.a.pos;
    this.a.move(springValve(bit(ax, 0)), dt);
    // Zylinder B steht im Hubweg
    if (this.b.pos > 0.15 && this.a.pos > 0.8 && aBefore <= 0.8 + 1e-9) {
      this.a.pos = 0.8;
      this.note.say('Kollision: Zylinder B steht im Hubweg – Hubtisch blockiert!', 5);
    }
    this.b.move(springValve(bit(ax, 1)), dt);

    // Kiste auf dem unteren Band
    if (this.stage === 'none' && !this.faulted) {
      this.#spawn -= dt;
      if (this.#spawn <= 0) { this.stage = 'belt'; this.s = 0; }
    }
    if (this.stage === 'belt') {
      this.s = Math.min(1, this.s + 0.25 * dt);
      if (this.s >= 1 && this.a.retracted) this.stage = 'platform';
    } else if (this.stage === 'platform') {
      if (this.b.pos > 0.2) {
        if (!this.a.extended) {
          this.stage = 'fallen';
          this.#fail('Kiste wurde geschoben, bevor der Hubtisch oben war – sie ist heruntergefallen!');
        } else if (this.b.pos >= 0.95) {
          this.stage = 'none'; this.#spawn = 1.5;
          this.upper.push(0);
          this.note.say('Kiste liegt auf dem oberen Band.', 3);
        }
      }
    }
    this.upper = this.upper.map((p) => p + 0.4 * dt).filter((p) => {
      if (p >= 1) { this.done++; return false; }
      return true;
    });
  }

  input(name: string, down: boolean) {
    if (name === 's1') {
      this.s1 = down;
      if (down && this.#fault) {
        this.#fault = ''; this.stage = 'none'; this.#spawn = 1.5; this.note.say('Störung quittiert.', 3);
      }
    }
  }

  reset() {
    this.a.pos = 0; this.b.pos = 0; this.stage = 'none'; this.s = 0; this.upper = []; this.done = 0; this.faults = 0;
    this.#fault = ''; this.#spawn = 1.5; this.note.clear();
  }
}
