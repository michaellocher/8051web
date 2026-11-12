/**
 * Poliermaschine: Ein Schlitten trägt das Werkstück unter der Polierscheibe (M2) hindurch. Der Vorschubmotor M1
 * treibt ihn nach rechts (M1R) oder links (M1L). Poliert wird nur bei laufender Scheibe; jede Stelle braucht
 * zwei Durchgänge (hin und zurück). Beide Motoren haben Übertemperatursensoren (mit den Schaltflächen
 * „überhitzen" auslösbar).
 *
 * Ax.0 H1  Meldelampe „Betrieb"                 Ex.0 S1  Taster START
 * Ax.1 H2  Meldelampe „Störung"                 Ex.1 S2  Taster STOP
 * Ax.2 M1R Vorschub rechts                      Ex.2 S3  Schlitten ganz links
 * Ax.3 M1L Vorschub links                       Ex.3 S4  Schlitten ganz rechts
 * Ax.4 M2  Polierscheibe                        Ex.4 S5  M2 Übertemperatur
 *                                               Ex.5 S6  Schlitten unter der Polierscheibe
 *                                               Ex.6 S7  M1 Übertemperatur
 *                                               Ex.7 S8  Werkstück eingespannt
 */
import { Motor, bit, pack, type ModelLogic } from '../logic.ts';
import { Notice } from './p2.util.ts';

const SPEED = 0.22, BINS = 10;

export class PoliererLogic implements ModelLogic {
  readonly m1 = new Motor(0.3);
  readonly m2 = new Motor(0.6);
  pos = 0;
  dir = 0;
  piece = true;
  /** Politurgrad je Abschnitt des Werkstücks */
  finish: number[] = Array.from({ length: BINS }, () => 0);
  polished = 0;
  temp1 = 0;
  temp2 = 0;
  hot1 = false;
  hot2 = false;
  heating1 = false;
  heating2 = false;
  startBtn = false;
  stopBtn = false;
  lampOp = false;
  lampFault = false;
  readonly note = new Notice();

  get inZone() { return this.pos > 0.3 && this.pos < 0.7; }
  get done() { return this.piece && this.finish.every((f) => f >= 0.95); }
  get ex() {
    return pack([this.startBtn, this.stopBtn, this.pos <= 0.02, this.pos >= 0.98, this.hot2, this.inZone, this.hot1, this.piece]);
  }
  get status() { return this.note.text; }

  step(ax: number, dt: number) {
    this.note.tick(dt);
    this.lampOp = bit(ax, 0); this.lampFault = bit(ax, 1);
    const right = bit(ax, 2), left = bit(ax, 3);
    this.dir = right && left ? 0 : right ? 1 : left ? -1 : 0;
    if (right && left) this.note.say('Kurzschluss: M1R und M1L gleichzeitig!', 5);
    this.m1.step(this.dir !== 0, dt, this.dir || 1);
    this.m2.step(bit(ax, 4), dt);
    const np = this.pos + this.dir * SPEED * dt;
    if (np < 0 || np > 1) this.note.say('Schlitten läuft gegen den Anschlag!', 4);
    this.pos = Math.min(1, Math.max(0, np));
    // Temperaturen
    this.temp1 = Math.min(1, Math.max(0, this.temp1 + ((this.heating1 ? 0.4 : -0.08)) * dt));
    this.temp2 = Math.min(1, Math.max(0, this.temp2 + ((this.heating2 ? 0.4 : -0.08)) * dt));
    this.hot1 = this.hot1 ? this.temp1 > 0.3 : this.temp1 >= 0.6;
    this.hot2 = this.hot2 ? this.temp2 > 0.3 : this.temp2 >= 0.6;
    if (this.hot1 || this.hot2) this.note.say(`${this.hot1 ? 'M1' : 'M2'} überhitzt!`, 1);
    // Polieren
    if (this.piece && this.m2.speed > 0.8) {
      for (let i = 0; i < BINS; i++) {
        if (Math.abs(this.pos - (i + 0.5) / BINS) < 0.05) this.finish[i] = Math.min(1, this.finish[i]! + 1.5 * dt);
      }
      if (this.done && this.finish.every((f) => f >= 0.95) && !this.#counted) { this.#counted = true; this.polished++; this.note.say('Werkstück fertig poliert.', 5); }
    }
  }
  #counted = false;

  input(name: string, down: boolean) {
    if (name === 'start') this.startBtn = down;
    if (name === 'stop') this.stopBtn = down;
    if (name === 'heat1') this.heating1 = down;
    if (name === 'heat2') this.heating2 = down;
    if (name === 'piece' && down) {
      if (this.pos > 0.02) { this.note.say('Werkstück nur bei Schlitten links wechseln.', 3); return; }
      this.piece = true; this.finish.fill(0); this.#counted = false; this.note.say('Neues Werkstück eingespannt.', 3);
    }
  }

  reset() {
    this.pos = 0; this.m1.speed = 0; this.m2.speed = 0; this.piece = true; this.finish.fill(0); this.#counted = false;
    this.polished = 0; this.temp1 = 0; this.temp2 = 0; this.note.clear();
  }
}
