/**
 * Palettierungsanlage: Kartons laufen auf dem Förderband bis zum Anschlag. Zylinder 1 schiebt jeden
 * Karton in den Lagenschacht, ist die Lage voll (3 Kartons), schiebt Zylinder 2 sie auf die Palette.
 * Eine Palette fasst 4 Lagen. Die Zylinder dürfen nicht gleichzeitig ausgefahren sein (Kollision).
 *
 * Ax.0 1Y1 Zylinder 1 ausfahren                 Ex.0 S1  Taster START
 * Ax.1 1Y2 Zylinder 1 einfahren                 Ex.1 S2  Lichtschranke: Karton am Anschlag
 * Ax.2 2Y1 Zylinder 2 ausfahren                 Ex.2 1S1 Zylinder 1 eingefahren
 * Ax.3 2Y2 Zylinder 2 einfahren                 Ex.3 1S2 Zylinder 1 ausgefahren
 * Ax.4 M1  Fördermotor                          Ex.4 2S1 Zylinder 2 eingefahren
 *                                               Ex.5 2S2 Zylinder 2 ausgefahren
 *                                               Ex.6 S3  Lage voll (Magazinsensor)
 *                                               Ex.7 S4  Palette voll
 */
import { Cylinder, MemoryValve, Motor, bit, pack, type ModelLogic } from '../logic.ts';
import { Notice } from './p2.util.ts';

export const END = 0.88, GAP = 0.13, BELT = 0.3, LAYER_CAP = 3, PALLET_CAP = 4;

export class PalettiererLogic implements ModelLogic {
  readonly c1 = new Cylinder(1.0);
  readonly c2 = new Cylinder(0.7);
  readonly v1 = new MemoryValve();
  readonly v2 = new MemoryValve();
  readonly motor = new Motor(0.2);
  /** Kartonpositionen 0 (Einlauf) … 1 */
  boxes: number[] = [];
  layer = 0;
  pallet = 0;
  moved = 0;
  start = false;
  readonly note = new Notice();

  get atEnd() { return this.boxes.some((p) => p >= END - 0.04); }
  get ex() {
    return pack([this.start, this.atEnd, this.c1.retracted, this.c1.extended, this.c2.retracted, this.c2.extended,
      this.layer >= LAYER_CAP, this.pallet >= PALLET_CAP]);
  }
  get status() { return this.note.text; }

  step(ax: number, dt: number) {
    this.note.tick(dt);
    this.motor.step(bit(ax, 4), dt);
    // Förderband: vorderster Karton bis zum Anschlag, die anderen stauen auf
    this.boxes.sort((a, b) => b - a);
    let limit = this.c1.pos > 0.3 ? END - 0.15 : END; // ausgefahrener Schieber versperrt den Anschlag
    this.boxes = this.boxes.map((p) => {
      const np = p >= limit ? p : Math.min(p + BELT * this.motor.speed * dt, limit);
      limit = np - GAP;
      return np;
    });
    // Zylinder 1 (Schieber in den Lagenschacht)
    const d1 = this.v1.update(bit(ax, 0), bit(ax, 1));
    let max1 = 1;
    if (d1 > 0 && this.c2.pos > 0.3) { max1 = 0.3; this.note.say('Kollision: Zylinder 1 fährt gegen Zylinder 2!', 5); }
    else if (d1 > 0 && this.layer >= LAYER_CAP && this.atEnd) { max1 = 0.5; this.note.say('Lage voll: erst Zylinder 2 ausfahren!', 5); }
    this.c1.move(d1, dt);
    if (this.c1.pos > max1) this.c1.pos = max1;
    if (this.c1.pos >= 0.6 && this.atEnd) {
      this.boxes = this.boxes.filter((p) => p < END - 0.04);
      this.layer++; this.moved++;
    }
    // Zylinder 2 (Lage auf Palette schieben)
    const d2 = this.v2.update(bit(ax, 2), bit(ax, 3));
    let max2 = 1;
    if (d2 > 0 && this.c1.pos > 0.3) { max2 = 0.3; this.note.say('Kollision: Zylinder 2 fährt gegen Zylinder 1!', 5); }
    else if (d2 > 0 && this.layer > 0 && this.pallet >= PALLET_CAP) { max2 = 0.5; this.note.say('Palette voll: bitte Palette wechseln!', 5); }
    this.c2.move(d2, dt);
    if (this.c2.pos > max2) this.c2.pos = max2;
    if (this.c2.pos >= 0.7 && this.layer > 0) {
      if (this.layer < LAYER_CAP) this.note.say('Lage unvollständig auf die Palette geschoben.', 4);
      this.layer = 0; this.pallet++;
      if (this.pallet >= PALLET_CAP) this.note.say('Palette voll.', 6);
    }
  }

  input(name: string, down: boolean) {
    if (name === 'start') this.start = down;
    if (!down) return;
    if (name === 'box') {
      if (this.boxes.every((p) => p > GAP + 0.02)) this.boxes.push(0);
      else this.note.say('Einlauf belegt.', 2);
    }
    if (name === 'pallet') { this.pallet = 0; this.note.say('Leere Palette bereitgestellt.', 3); }
  }

  reset() {
    this.c1.pos = 0; this.c2.pos = 0; this.v1.dir = -1; this.v2.dir = -1; this.motor.speed = 0;
    this.boxes = []; this.layer = 0; this.pallet = 0; this.moved = 0; this.note.clear();
  }
}
