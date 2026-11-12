/** Tongeber und Keyboard (reine Logik, kein DOM). */

/** Notenlänge (D4–D6) → Bruchteil einer ganzen Note */
export const LENGTH_NAMES: Record<number, string> = { 1: '1/16', 2: '1/8', 3: '1/4', 4: '1/2', 5: 'ganze' };
/** Dauer einer ganzen Note in Mikrosekunden (Viertel = 0,5 s, also 120 Viertel pro Minute) */
export const WHOLE_US = 2_000_000;
const LENGTH_FRACTION: Record<number, number> = { 1: 1 / 16, 2: 1 / 8, 3: 1 / 4, 4: 1 / 2, 5: 1 };

const NOTE_NAMES = ['', 'C1', 'CIS', 'D1', 'DIS', 'E1', 'F1', 'FIS', 'G1', 'GIS', 'A1', 'AIS', 'H1', 'C2', 'CIS2', 'D2'];
export const noteName = (n: number) => NOTE_NAMES[n] ?? '';
/** Frequenz der Note 1–15 (1 = C1 = eingestrichenes c = 261,6 Hz) */
export const noteFreq = (n: number) => 440 * 2 ** ((n - 10) / 12);

export interface Tone {
  /** 0 = Pause, sonst 1–15 */
  note: number;
  /** 1–5 */
  length: number;
  /** Dauer in µs */
  us: number;
}

/** Datenbyte → Ton; undefined, wenn kein gültiger Ton (Länge 0, 6, 7) */
export function decodeTone(byte: number): Tone | undefined {
  const length = (byte >> 4) & 7;
  const frac = LENGTH_FRACTION[length];
  if (frac === undefined) return undefined;
  return { note: byte & 15, length, us: WHOLE_US * frac };
}
/** Ton → Datenbyte (Gegenstück zu decodeTone) */
export const encodeTone = (note: number, length: number) => ((length & 7) << 4) | (note & 15);

/**
 * Tongeber: Jeder Schreibzugriff auf den Port mit gültigem Ton startet ihn für seine Dauer
 * (Simulationszeit). Schreibt das Programm weiter, während ein Ton läuft, wird der neue Ton
 * hinten angestellt; ein erneutes Schreiben desselben Werts im ersten Teil des laufenden Tons
 * (Abfrageschleife) wird ignoriert.
 */
export class ToneGenerator {
  current: Tone | undefined;
  /** Zählt jeden gestarteten Ton (auch gleiche hintereinander) */
  serial = 0;
  #remaining = 0;
  #queue: { byte: number; tone: Tone }[] = [];
  #playing = -1;

  write(byte: number) {
    const tone = decodeTone(byte);
    if (!tone) return;
    if (this.current && this.#remaining > tone.us / 2 && byte === this.#playing && this.#queue.length === 0) return;
    if (this.#queue.length > 0 && this.#queue[this.#queue.length - 1]!.byte === byte) return;
    if (!this.current) this.#start(byte, tone);
    else if (this.#queue.length < 32) this.#queue.push({ byte, tone });
  }
  /** Simulationszeit vorrücken (µs) */
  advance(us: number) {
    while (this.current && us >= this.#remaining) {
      us -= this.#remaining;
      const next = this.#queue.shift();
      if (next) this.#start(next.byte, next.tone);
      else { this.current = undefined; this.#remaining = 0; this.#playing = -1; }
    }
    if (this.current) this.#remaining -= us;
  }
  /** Läuft ein Ton (keine Pause)? */
  get sounding(): boolean { return !!this.current && this.current.note > 0; }
  get remainingUs() { return this.#remaining; }
  reset() { this.current = undefined; this.#queue = []; this.#remaining = 0; this.#playing = -1; }
  #start(byte: number, tone: Tone) {
    this.current = tone;
    this.#remaining = tone.us;
    this.#playing = byte;
    this.serial++;
  }
}

/**
 * Keyboard (eine Oktave C … C): Die Taste liefert den Tongeber-Code: D0–D3 = Note (C = 1 … C2 = 13),
 * D4–D6 = 011 (Viertelnote), D7 = 0. Ohne Taste liegt 00h an (kein Ton).
 */
export const KEY_LENGTH = 3;
export const KEYBOARD_KEYS = [
  { note: 1, white: true, key: 'a', label: 'C' }, { note: 2, white: false, key: 'w', label: 'CIS' },
  { note: 3, white: true, key: 's', label: 'D' }, { note: 4, white: false, key: 'e', label: 'DIS' },
  { note: 5, white: true, key: 'd', label: 'E' }, { note: 6, white: true, key: 'f', label: 'F' },
  { note: 7, white: false, key: 't', label: 'FIS' }, { note: 8, white: true, key: 'g', label: 'G' },
  { note: 9, white: false, key: 'z', label: 'GIS' }, { note: 10, white: true, key: 'h', label: 'A' },
  { note: 11, white: false, key: 'u', label: 'AIS' }, { note: 12, white: true, key: 'j', label: 'H' },
  { note: 13, white: true, key: 'k', label: 'C' },
] as const;

export class Keyboard {
  /** gedrückte Noten (zuletzt gedrückte gilt) */
  #held: number[] = [];
  press(note: number) { this.release(note); this.#held.push(note); }
  release(note: number) { this.#held = this.#held.filter((n) => n !== note); }
  get note(): number { return this.#held[this.#held.length - 1] ?? 0; }
  /** Externer Pegel am Port */
  drive(): number { return this.note === 0 ? 0x00 : encodeTone(this.note, KEY_LENGTH); }
}
