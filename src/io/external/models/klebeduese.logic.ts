/**
 * Klebedüse: Kartons laufen auf einem Förderband unter der Düse hindurch. Die Düse Y1 soll nur so lange
 * öffnen, wie es die Vorwahlgröße B1 verlangt: Öffnungszeit = Vorwahl × 0,2 s.
 *
 * Ax.0 Y1  Klebedüse öffnen                     Ex.0 S1  Sensor: Karton unter der Düse
 *                                               Ex.1–3 B1  Vorwahlgröße 0…7 (Ex.1 = Wertigkeit 1, Ex.2 = 2, Ex.3 = 4)
 */
import { bit, pack, type ModelLogic } from '../logic.ts';
import { Notice, num } from './p2.util.ts';

export const NOZZLE = 0.5, BOX_LEN = 0.34, BELT = 0.2, UNIT = 0.2;

export interface Karton { x: number; glue: number }

export class KlebeLogic implements ModelLogic {
  boxes: Karton[] = [];
  /** Vorwahlgröße 0…7 */
  preset = 3;
  auto = false;
  nozzle = false;
  good = 0;
  bad = 0;
  beltGlue = 0;
  readonly note = new Notice();
  #autoT = 0;

  get under() { return this.boxes.some((b) => Math.abs(b.x - NOZZLE) <= BOX_LEN / 2); }
  get ex() { return pack([this.under, ...[0, 1, 2].map((i) => ((this.preset >> i) & 1) === 1)]); }
  get status() { return this.note.text; }

  step(ax: number, dt: number) {
    this.note.tick(dt);
    this.nozzle = bit(ax, 0);
    if (this.auto) { this.#autoT -= dt; if (this.#autoT <= 0) { this.spawn(); this.#autoT = 4.5; } }
    for (const b of this.boxes) b.x += BELT * dt;
    if (this.nozzle) {
      const b = this.boxes.find((k) => Math.abs(k.x - NOZZLE) <= BOX_LEN / 2);
      if (b) b.glue += dt;
      else { this.beltGlue += dt; this.note.say('Störung: Kleber tropft auf das Förderband!', 4); }
    }
    for (const b of this.boxes.filter((k) => k.x - BOX_LEN / 2 > 1)) {
      const soll = this.preset * UNIT;
      const ok = Math.abs(b.glue - soll) <= 0.15 * soll + 0.05;
      if (ok) this.good++; else this.bad++;
      this.note.say(`Karton: ${num(b.glue)} s Kleber, Soll ${num(soll)} s – ${ok ? 'OK' : 'falsch'}`, 5);
    }
    this.boxes = this.boxes.filter((k) => k.x - BOX_LEN / 2 <= 1);
  }

  spawn() {
    if (this.boxes.every((b) => b.x > BOX_LEN / 2 + 0.12)) this.boxes.push({ x: -BOX_LEN / 2, glue: 0 });
  }

  input(name: string, down: boolean) {
    if (name === 'auto') { this.auto = down; this.#autoT = 0.5; return; }
    if (!down) return;
    if (name === 'box') this.spawn();
    if (name === 'up') this.preset = Math.min(7, this.preset + 1);
    if (name === 'down') this.preset = Math.max(0, this.preset - 1);
  }

  reset() { this.boxes = []; this.good = 0; this.bad = 0; this.beltGlue = 0; this.note.clear(); }
}
