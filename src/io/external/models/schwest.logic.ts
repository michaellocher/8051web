/**
 * Schwesternrufanlage (Modellvariante B, mit Drahtbruchsicherheit): Drei Patientenzimmer rufen die
 * Schwester. Alle Taster sind Öffner (Ex = 1 in Ruhe, 0 bei Betätigung).
 * Ein Ruf wird an der Flurlampe P1.x über der Zimmertür und am Schwesternzimmer (P2.x) angezeigt und
 * lässt den Summer P0 ertönen. Der Summer wird im Schwesternzimmer mit S3 quittiert, der Ruf selbst
 * erlischt erst, wenn die Schwester im Zimmer ihre Anwesenheitstaste S2.x drückt.
 *
 * Ax.0 P1.1 Flurlampe Zimmer 1         Ex.0 S1.1 Ruftaster Zimmer 1
 * Ax.1 P1.2 Flurlampe Zimmer 2         Ex.1 S2.1 Anwesenheit Zimmer 1
 * Ax.2 P1.3 Flurlampe Zimmer 3         Ex.2 S1.2 Ruftaster Zimmer 2
 * Ax.3 P2.1 Anzeige Schwesternzimmer 1 Ex.3 S2.2 Anwesenheit Zimmer 2
 * Ax.4 P2.2 Anzeige Schwesternzimmer 2 Ex.4 S1.3 Ruftaster Zimmer 3
 * Ax.5 P2.3 Anzeige Schwesternzimmer 3 Ex.5 S2.3 Anwesenheit Zimmer 3
 * Ax.6 P0  Summer                      Ex.6 S3  Quittieren Summer (Schwesternzimmer)
 */
import { bit, pack, type ModelLogic } from '../logic.ts';
import { hold } from './p1.util.ts';

export class SchwestLogic implements ModelLogic {
  readonly call = [false, false, false];
  readonly pres = [false, false, false];
  quitBtn = false;
  /** Patient wartet noch auf die Schwester */
  readonly waiting = [false, false, false];
  ax = 0;
  #silent = [0, 0, 0];
  /** Summer wurde zuletzt gehört (Zähler, für Anzeige) */
  buzzTime = 0;

  get ex() {
    return pack([!this.call[0], !this.pres[0], !this.call[1], !this.pres[1], !this.call[2], !this.pres[2], !this.quitBtn]);
  }
  get buzzer() { return bit(this.ax, 6); }

  step(ax: number, dt: number) {
    this.ax = ax;
    for (let i = 0; i < 3; i++) {
      if (this.call[i]) this.waiting[i] = true;
      if (this.pres[i]) this.waiting[i] = false;
      this.#silent[i] = hold(this.#silent[i]!, this.waiting[i]! && !bit(ax, i), dt);
    }
    this.buzzTime = this.buzzer ? this.buzzTime + dt : 0;
  }

  /** call1…3, pres1…3, quit: gedrückt = down */
  input(name: string, down: boolean) {
    const m = /^(call|pres)([1-3])$/.exec(name);
    if (m) (m[1] === 'call' ? this.call : this.pres)[Number(m[2]) - 1] = down;
    if (name === 'quit') this.quitBtn = down;
  }

  get status() {
    const silent = this.#silent.findIndex((s) => s > 1);
    if (silent >= 0) return `Zimmer ${silent + 1} ruft – keine Anzeige am Flur!`;
    const w = this.waiting.flatMap((x, i) => (x ? [i + 1] : []));
    if (this.buzzer) return `Rufsummer – Ruf aus Zimmer ${w.join(', ')}`;
    return w.length ? `Zimmer ${w.join(', ')} wartet auf die Schwester` : '';
  }

  reset() {
    this.call.fill(false); this.pres.fill(false); this.waiting.fill(false);
    this.quitBtn = false; this.ax = 0; this.#silent = [0, 0, 0]; this.buzzTime = 0;
  }
}
