import { hex2, hex4 } from '../core/sfr.ts';
import { h, inlineEdit, parseHexInput, rowHeight } from './dom.ts';

export interface HexViewOptions {
  mem: () => Uint8Array;
  size: () => number;
  onEdit: (addr: number, value: number) => void;
}

/** Virtualisierte Speicheransicht (8 Byte pro Zeile + ASCII) */
export class HexView {
  readonly #el: HTMLElement;
  readonly #spacer: HTMLElement;
  readonly #opts: HexViewOptions;
  #rows: { row: HTMLElement; adr: HTMLElement; cells: HTMLElement[]; ascii: HTMLElement }[] = [];
  #rowH = 17;
  #baseline: Uint8Array | undefined;
  /** aktueller Befehl (rote Umrandung) */
  pc: { start: number; len: number } | undefined;
  reads = new Set<number>();
  writes = new Set<number>();
  highlightChanges = true;
  /** Inhalt verbergen (verschlüsseltes Programm) */
  masked = false;

  constructor(el: HTMLElement, opts: HexViewOptions) {
    this.#el = el;
    this.#opts = opts;
    this.#spacer = h('div', { class: 'spacer' });
    el.append(this.#spacer);
    el.addEventListener('scroll', () => this.render(), { passive: true });
    new ResizeObserver(() => { this.#rowH = rowHeight(el); this.render(); }).observe(el);
    el.addEventListener('click', (e) => {
      const cell = (e.target as HTMLElement).closest<HTMLElement>('.hx');
      if (cell?.dataset['addr'] && !this.masked) this.#edit(cell, Number(cell.dataset['addr']));
    });
  }

  markBaseline() {
    this.#baseline = this.#opts.mem().slice(0, this.#opts.size());
  }
  clearBaseline() { this.#baseline = undefined; }

  get element(): HTMLElement { return this.#el; }

  /** Zelle für eine Adresse (scrollt bei Bedarf dorthin) */
  cell(addr: number, scroll = true): HTMLElement | undefined {
    if (scroll) this.ensureVisible(addr);
    return this.#el.querySelector<HTMLElement>(`.hx[data-addr="${addr}"]`) ?? undefined;
  }

  ensureVisible(addr: number) {
    const row = Math.floor(addr / 8);
    const top = row * this.#rowH;
    const { scrollTop, clientHeight } = this.#el;
    if (top < scrollTop || top + this.#rowH > scrollTop + clientHeight) {
      this.#el.scrollTop = Math.max(0, top - clientHeight / 3);
      this.render();
    }
  }

  render() {
    const size = this.#opts.size();
    const mem = this.#opts.mem();
    const total = Math.ceil(size / 8);
    this.#spacer.style.height = `${total * this.#rowH}px`;
    const first = Math.max(0, Math.floor(this.#el.scrollTop / this.#rowH) - 2);
    const count = Math.min(total - first, Math.ceil(this.#el.clientHeight / this.#rowH) + 4);
    while (this.#rows.length < count) {
      const adr = h('span', { class: 'ha' });
      const cells = Array.from({ length: 8 }, () => h('span', { class: 'hx' }));
      const ascii = h('span', { class: 'hx-ascii' });
      const row = h('div', { class: 'hx-row' }, adr, ...cells, ascii);
      this.#el.append(row);
      this.#rows.push({ row, adr, cells, ascii });
    }
    this.#rows.forEach((r, i) => {
      if (i >= count) { r.row.hidden = true; return; }
      r.row.hidden = false;
      const rowIdx = first + i;
      const base = rowIdx * 8;
      r.row.style.transform = `translateY(${rowIdx * this.#rowH}px)`;
      r.adr.textContent = hex4(base);
      let ascii = '';
      r.cells.forEach((c, j) => {
        const a = base + j;
        const v = mem[a]!;
        const s = this.masked ? '··' : hex2(v);
        if (c.textContent !== s) c.textContent = s;
        c.dataset['addr'] = String(a);
        const inPc = this.pc !== undefined && a >= this.pc.start && a < this.pc.start + this.pc.len;
        c.classList.toggle('pc', inPc && a === this.pc!.start);
        c.classList.toggle('ins', inPc && a !== this.pc!.start);
        c.classList.toggle('chg', this.highlightChanges && this.#baseline !== undefined && this.#baseline[a] !== v);
        c.classList.toggle('acc-r', this.reads.has(a));
        c.classList.toggle('acc-w', this.writes.has(a));
        c.classList.toggle('zero', v === 0);
        ascii += this.masked ? '·' : v >= 0x20 && v < 0x7f ? String.fromCharCode(v) : '.';
      });
      r.ascii.textContent = ascii;
    });
  }

  async #edit(cell: HTMLElement, addr: number) {
    const v = await inlineEdit(cell, cell.textContent ?? '', 2);
    if (v === undefined) return;
    const n = parseHexInput(v, 0xff);
    if (n !== undefined) this.#opts.onEdit(addr, n);
  }
}
