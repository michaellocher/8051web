/**
 * Zweitanksystem: Becken 1 wird über V1 gefüllt, fließt über V2 in Becken 2 und wird über V3 entnommen.
 *
 * Ax.0 V1  Zulaufventil Becken 1                Ex.0 S0  Taster EIN
 * Ax.1 V2  Ventil Becken 1 → Becken 2           Ex.1 S1  Taster AUS
 * Ax.2 V3  Entnahmeventil Becken 2              Ex.2 S2  Taster Entnahme gewünscht
 * Ax.3 H1  Meldelampe „Anlage EIN"              Ex.3 S3  Becken 1 voll
 *                                               Ex.4 S4  Becken 1 nicht leer (Min-Sensor taucht ein)
 *                                               Ex.5 S5  Becken 2 voll
 *                                               Ex.6 S6  Becken 2 nicht leer
 */
import { bit, clamp01, pack, type ModelLogic } from '../logic.ts';
import { Notice } from './p2.util.ts';

const IN1 = 0.22, FLOW12 = 0.3, OUT3 = 0.3;

export class ZweitankLogic implements ModelLogic {
  level1 = 0;
  level2 = 0;
  ein = false;
  aus = false;
  entnahme = false;
  v1 = false;
  v2 = false;
  v3 = false;
  lamp = false;
  overflows = 0;
  readonly note = new Notice();

  get ex() {
    return pack([this.ein, this.aus, this.entnahme, this.level1 >= 0.9, this.level1 > 0.08, this.level2 >= 0.9, this.level2 > 0.08]);
  }
  get status() { return this.note.text; }

  step(ax: number, dt: number) {
    this.v1 = bit(ax, 0); this.v2 = bit(ax, 1); this.v3 = bit(ax, 2); this.lamp = bit(ax, 3);
    this.note.tick(dt);
    const f12 = this.v2 && this.level1 > 0 && this.level2 < 1 ? FLOW12 : 0;
    const f3 = this.v3 && this.level2 > 0 ? OUT3 : 0;
    const l1 = this.level1 + ((this.v1 ? IN1 : 0) - f12) * dt;
    const l2 = this.level2 + (f12 - f3) * dt;
    if (l1 > 1) { this.note.say('Störung: Becken 1 läuft über!', 5); this.overflows++; }
    if (l2 > 1) { this.note.say('Störung: Becken 2 läuft über!', 5); this.overflows++; }
    if (this.v2 && this.level1 <= 0 && this.level2 < 1) this.note.say('V2 offen, Becken 1 ist leer.', 1);
    this.level1 = clamp01(l1);
    this.level2 = clamp01(l2);
  }

  input(name: string, down: boolean) {
    if (name === 'ein') this.ein = down;
    if (name === 'aus') this.aus = down;
    if (name === 'entnahme') this.entnahme = down;
  }

  reset() {
    this.level1 = 0; this.level2 = 0; this.overflows = 0; this.note.clear();
    this.v1 = this.v2 = this.v3 = this.lamp = false;
  }
}
