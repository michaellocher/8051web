/**
 * Förderanlage II (Modellvariante A, Schließer): Zwei Zubringerbänder M1 und M2 (je mit Vorratstrichter) fördern ihr
 * Schüttgut auf das Sammelband M3. Das Material braucht 3 s bis zum Bandende. Steht M3, während M1 oder M2
 * fördern, staut sich das Gut auf dem Sammelband. Richtige Reihenfolge: M3 zuerst, dann M2, dann M1;
 * ausschalten umgekehrt. Betriebsart Hand (A/M = 0): jedes Band einzeln mit Start/Stop, Automatik (A/M = 1): Gesamtablauf.
 * NOT-AUS (rastend, 1 = gedrückt) muss alle Bänder sofort stoppen. Störungen erscheinen in der Fehlerliste.
 *
 * Ax.0 M1  Zubringerband 1                         Ex.0 S1  Taster Start M1
 * Ax.1 M2  Zubringerband 2                         Ex.1 S2  Taster Stop M1 (1 = gedrückt)
 * Ax.2 M3  Sammelband                              Ex.2 S3  Taster Start M2
 * Ax.3 H1  Meldeleuchte RUN (Anlage läuft)         Ex.3 S4  Taster Stop M2
 * Ax.4 H2  Meldeleuchte Automatik                  Ex.4 S5  Taster Start M3
 *                                                  Ex.5 S6  Taster Stop M3
 *                                                  Ex.6 S7  NOT-AUS (1 = betätigt)
 *                                                  Ex.7 S8  Schalter Hand/Automatik (1 = Automatik)
 */
import { Motor, bit, clamp01, pack, type ModelLogic } from '../logic.ts';

const TRAVEL = 3;

export class Foerder2Logic implements ModelLogic {
  readonly m = [new Motor(0.4), new Motor(0.4), new Motor(0.4)] as const;
  /** Gutfront auf M1/M2: 0 = nur am Trichter, 1 = am Bandende angekommen */
  front = [0, 0];
  /** Haufen auf dem stehenden Sammelband 0..1 */
  pile = 0;
  piles = 0;
  /** gefördertes Gut (Sekunden Zufuhr auf laufendes M3) */
  delivered = 0;
  feeding = false;
  piling = false;
  btn = { s1: false, s2: false, s3: false, s4: false, s5: false, s6: false, s7: false, s8: false };
  h1 = false; h2 = false;
  readonly errors: string[] = [];
  #latched = new Set<string>();
  #cmd = [false, false, false];
  #nt = 0;

  get ex() {
    const b = this.btn;
    return pack([b.s1, b.s2, b.s3, b.s4, b.s5, b.s6, b.s7, b.s8]);
  }
  get status() { return this.errors.at(-1) ?? ''; }

  #err(key: string, text: string, active: boolean) {
    if (active && !this.#latched.has(key)) { this.#latched.add(key); this.errors.push(text); if (this.errors.length > 8) this.errors.shift(); }
    if (!active) this.#latched.delete(key);
  }

  step(ax: number, dt: number) {
    const cmd = [bit(ax, 0), bit(ax, 1), bit(ax, 2)];
    this.h1 = bit(ax, 3); this.h2 = bit(ax, 4);
    cmd.forEach((c, i) => this.m[i]!.step(c, dt));
    // Reihenfolge beim Anlauf
    for (const i of [0, 1]) {
      if (cmd[i] && !this.#cmd[i] && !this.m[2].running) this.errors.push(`M${i + 1} gestartet, obwohl Sammelband M3 steht!`);
      if (this.errors.length > 8) this.errors.shift();
    }
    this.#cmd = cmd;
    // Gut transportieren
    this.feeding = false; this.piling = false;
    for (const i of [0, 1]) {
      const mi = this.m[i]!;
      if (mi.speed > 0.3) this.front[i] = clamp01(this.front[i]! + (mi.speed * dt) / TRAVEL);
      if (mi.speed > 0.3 && this.front[i]! >= 1) {
        if (this.m[2].speed > 0.3) { this.feeding = true; this.delivered += dt; }
        else { this.piling = true; this.pile = clamp01(this.pile + 0.15 * dt); }
      }
    }
    this.#err('stau', 'STAU: Band M1/M2 fördert auf stehendes Sammelband M3!', this.piling);
    if (this.piling && !this.#latched.has('stau2')) { this.#latched.add('stau2'); this.piles++; }
    if (!this.piling) this.#latched.delete('stau2');
    this.#err('notaus', 'NOT-AUS betätigt – Anlage steht.', this.btn.s7);
    this.#nt = this.btn.s7 && cmd.some(Boolean) ? this.#nt + dt : 0;
    this.#err('notaus-ign', 'NOT-AUS betätigt, aber Antrieb läuft weiter!', this.#nt > 0.5);
    this.#err('m3', 'M3 steht, während M1/M2 noch laufen!', cmd[2] !== true && (cmd[0] === true || cmd[1] === true));
  }

  input(name: string, down: boolean) {
    if (name === 'clear' && down) { this.errors.length = 0; this.#latched.clear(); return; }
    if (name in this.btn) (this.btn as Record<string, boolean>)[name] = down;
  }

  reset() {
    for (const m of this.m) m.speed = 0;
    this.front = [0, 0]; this.pile = 0; this.piles = 0; this.delivered = 0; this.errors.length = 0; this.#latched.clear();
    this.#cmd = [false, false, false]; this.#nt = 0; this.btn.s7 = false;
  }
}
