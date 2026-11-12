/**
 * Abfüllanlage: Flaschen werden aus einem Magazin auf ein Förderband gesetzt, laufen unter den Silo-Auslauf,
 * werden gefüllt und fallen am Bandende in eine Kiste. Das Steuerprogramm muss das Band am Füllplatz
 * anhalten und das Ventil genau so lange öffnen, bis die Flasche voll ist (kein Füllstandssensor).
 *
 * Ax.0 Y2  Magazin gibt eine Flasche frei (Impuls)    Ex.0 S1  Hauptschalter (0/I, rastend)
 * Ax.1 Y1  Silo-Ventil (Auslauf auf)                  Ex.1 S2  Lichtschranke: Flasche am Füllplatz
 * Ax.2 M   Bandmotor                                  Ex.2 S3  Silo-Füllstand (1 = Silo ausreichend gefüllt)
 * Ax.7 P   Meldelampe „Silo leer“
 *
 * Eine Flasche ist bei 90–110 % Füllung gut. Läuft Produkt ohne Flasche aus, läuft eine Flasche über
 * oder wird sie nicht voll, meldet das Modell es in der Fußleiste. „Silo nachfüllen“ füllt den Silo auf.
 */
import { bit, pack, type ModelLogic } from '../logic.ts';
import { Notice } from './p2.util.ts';

export interface Bottle { x: number; fill: number }

export const FILL_POS = 0.55;
export const BELT_SPEED = 0.3;
/** Füllgeschwindigkeit einer Flasche in 1/s (voll nach 2 s) */
export const FILL_RATE = 0.5;
/** Anteil des Silo-Inhalts je Flaschenfüllung */
const SILO_PER_BOTTLE = 1 / 16;

export class AbfuellLogic implements ModelLogic {
  bottles: Bottle[] = [];
  /** Silo-Füllstand 0..1 */
  level = 1;
  main = false;
  goodCount = 0;
  badCount = 0;
  spilled = 0;
  beltAngle = 0;
  readonly note = new Notice();
  #prevY2 = false;

  get atFill() { return this.bottles.some((b) => Math.abs(b.x - FILL_POS) < 0.03); }
  get ex() { return pack([this.main, this.atFill, this.level > 0.15]); }
  get status() { return this.note.text; }

  step(ax: number, dt: number) {
    this.note.tick(dt);
    const y2 = bit(ax, 0), valve = bit(ax, 1), motor = bit(ax, 2);
    if (y2 && !this.#prevY2) {
      if (this.bottles.some((b) => b.x < 0.1)) this.note.say('Magazin: Eingang am Band ist noch belegt – Flasche kann nicht abgesetzt werden.', 4);
      else this.bottles.push({ x: 0.04, fill: 0 });
    }
    this.#prevY2 = y2;
    if (motor) {
      this.beltAngle = (this.beltAngle + 200 * dt) % 360;
      for (const b of this.bottles) b.x += BELT_SPEED * dt;
    }
    if (valve && this.level > 0) {
      const flow = Math.min(FILL_RATE * dt, this.level / SILO_PER_BOTTLE);
      const target = this.bottles.find((b) => Math.abs(b.x - FILL_POS) < 0.045);
      this.level = Math.max(0, this.level - flow * SILO_PER_BOTTLE);
      if (!target) {
        this.spilled += flow;
        this.note.say('Produkt läuft aus: Ventil offen, aber keine Flasche unter dem Auslauf!', 4);
      } else {
        if (target.fill < 1.15) target.fill += flow;
        if (target.fill > 1.1) this.note.say('Flasche läuft über – Ventil zu lange geöffnet!', 4);
      }
    } else if (valve && this.level <= 0) this.note.say('Silo leer – es fließt nichts mehr.', 4);
    // Bandende: Flaschen fallen in die Kiste
    this.bottles = this.bottles.filter((b) => {
      if (b.x < 1) return true;
      if (b.fill >= 0.9 && b.fill <= 1.1) this.goodCount++;
      else { this.badCount++; this.note.say(b.fill < 0.9 ? 'Ausschuss: Flasche nicht voll gefüllt.' : 'Ausschuss: Flasche übergelaufen.', 5); }
      return false;
    });
  }

  input(name: string, down: boolean) {
    if (name === 'main') this.main = down;
    if (name === 'refill' && down) { this.level = 1; this.note.say('Silo nachgefüllt.', 3); }
  }

  reset() {
    this.bottles = []; this.level = 1; this.goodCount = 0; this.badCount = 0; this.spilled = 0; this.#prevY2 = false; this.note.clear();
  }
}
