/** Kleine Hilfen für Modellpaket 2 (ohne DOM). */

/** Zeitlich begrenzte Statusmeldung */
export class Notice {
  #t = 0;
  #s = '';
  say(text: string, secs = 4) { this.#s = text; this.#t = secs; }
  tick(dt: number) { if (this.#t > 0) this.#t -= dt; }
  clear() { this.#t = 0; this.#s = ''; }
  get text() { return this.#t > 0 ? this.#s : ''; }
}

/** Zahl mit Dezimalkomma */
export const num = (v: number, digits = 1) => v.toFixed(digits).replace('.', ',');
