/** „ASM-Datei anzeigen": Quelltext zum aktuellen Programm, die gerade ausgeführte Zeile ist markiert. */
import { $, h } from './dom.ts';
import { makeWindow, openWindow } from './winutil.ts';

export class AsmView {
  readonly #win = $('[data-window="asm"]');
  readonly #view = $('[data-srcview]');
  #lines: HTMLElement[] = [];
  #current = -1;
  #lineOf: ReadonlyMap<number, number> = new Map();

  constructor() {
    makeWindow(this.#win, { left: Math.max(20, innerWidth - 640), top: 100 });
  }

  get open() { return !this.#win.hidden; }
  toggle() { if (this.open) this.#win.hidden = true; else openWindow(this.#win); }
  close() { this.#win.hidden = true; }

  /** Quelltext setzen; lineOf: Adresse → Quellzeile (vom Assembler) */
  set(name: string, source: string | undefined, lineOf: ReadonlyMap<number, number>) {
    $('[data-bind="srctitle"]').textContent = source === undefined ? 'ASM-Datei' : name;
    this.#lineOf = lineOf;
    this.#current = -1;
    if (source === undefined) {
      this.#lines = [];
      this.#view.replaceChildren(h('span', { class: 'muted', text: 'Zu diesem Programm ist keine ASM-Datei vorhanden. Öffnen Sie die ASM-Datei mit „Öffnen“ oder schreiben Sie das Programm im Editor.' }));
      return;
    }
    this.#lines = source.split(/\r?\n/).map((l, i) => h('div', { class: 'src-line' }, h('span', { class: 'src-no', text: String(i + 1) }), l || ' '));
    this.#view.replaceChildren(...this.#lines);
  }

  /** markiert die Zeile, die zum PC gehört */
  show(pc: number) {
    if (!this.open) return;
    const line = this.#lineOf.get(pc);
    const idx = line === undefined ? -1 : line - 1;
    if (idx === this.#current) return;
    this.#lines[this.#current]?.classList.remove('cur');
    this.#current = idx;
    const el = this.#lines[idx];
    if (el) {
      el.classList.add('cur');
      el.scrollIntoView({ block: 'nearest' });
    }
  }
}
