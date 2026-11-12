/**
 * Verpackungsrollenbahn: Ein Paket liegt auf dem Hubtisch. Der Hubzylinder fährt es auf Höhe der oberen
 * Rollenbahn, der Schieber schiebt es hinüber. Der Schieber darf nur bei angehobenem Hubtisch fahren,
 * der Hubtisch nur bei eingefahrenem Schieber.
 *
 * Ax.0 1Y1 Hubtisch heben                       Ex.0 S1  Taster START
 * Ax.1 1Y2 Hubtisch senken                      Ex.1 S2  Paket auf dem Hubtisch
 * Ax.2 2Y1 Schieber ausfahren                   Ex.2 1S1 Hubtisch unten
 * Ax.3 2Y2 Schieber einfahren                   Ex.3 1S2 Hubtisch oben
 *                                               Ex.4 2S1 Schieber eingefahren
 *                                               Ex.5 2S2 Schieber ausgefahren
 */
import { Cylinder, MemoryValve, bit, pack, type ModelLogic } from '../logic.ts';
import { Notice } from './p2.util.ts';

export class RollenbahnLogic implements ModelLogic {
  readonly lift = new Cylinder(0.6);
  readonly push = new Cylinder(1.0);
  readonly vl = new MemoryValve();
  readonly vp = new MemoryValve();
  /** Paket liegt auf dem Hubtisch */
  pkg = false;
  /** Pakete auf der Abtransport-Rollenbahn (Position 0…1) */
  out: number[] = [];
  delivered = 0;
  start = false;
  readonly note = new Notice();

  get ex() { return pack([this.start, this.pkg, this.lift.retracted, this.lift.extended, this.push.retracted, this.push.extended]); }
  get status() { return this.note.text; }

  step(ax: number, dt: number) {
    this.note.tick(dt);
    const dp = this.vp.update(bit(ax, 2), bit(ax, 3));
    if (dp > 0 && !this.lift.extended && this.push.pos >= 0.2) {
      this.push.pos = Math.min(this.push.pos, 0.2);
      this.note.say('Kollision: Schieber fährt aus, obwohl der Hubtisch nicht oben ist!', 6);
    } else this.push.move(dp, dt);
    if (this.push.pos > 0.2 && !this.lift.extended) this.push.pos = 0.2;
    const dl = this.vl.update(bit(ax, 0), bit(ax, 1));
    if (this.push.pos > 0.1 && (dl > 0 ? !this.lift.extended : !this.lift.retracted)) this.note.say('Kollision: Hubtisch fährt bei ausgefahrenem Schieber!', 6);
    else this.lift.move(dl, dt);
    if (this.push.pos >= 0.9 && this.lift.extended && this.pkg) { this.pkg = false; this.out.push(0); }
    this.out = this.out.map((p) => p + 0.3 * dt).filter((p) => {
      if (p < 1) return true;
      this.delivered++; this.note.say(`Paket verpackt (${this.delivered}).`, 3);
      return false;
    });
  }

  input(name: string, down: boolean) {
    if (name === 'start') this.start = down;
    if (name === 'pack' && down) {
      if (this.pkg) this.note.say('Hubtisch ist schon belegt.', 2);
      else if (!this.lift.retracted) this.note.say('Paket kann nur auf den unteren Hubtisch gelegt werden.', 3);
      else this.pkg = true;
    }
  }

  reset() {
    this.lift.pos = 0; this.push.pos = 0; this.vl.dir = -1; this.vp.dir = -1; this.pkg = false; this.out = []; this.delivered = 0; this.note.clear();
  }
}
