import type { CodeRow } from '../core/disasm.ts';
import { hex2, hex4 } from '../core/sfr.ts';
import { h, rowHeight } from './dom.ts';

/** Virtualisiertes Code-Fenster: eine Zeile pro Byte wie im Original. */
export class CodeView {
  readonly #el: HTMLElement;
  readonly #spacer: HTMLElement;
  #rows: CodeRow[] = [];
  /** Adresse → Zeilenindex (-1 = keine Zeile) */
  #index = new Int32Array(0x10000).fill(-1);
  #pool: { row: HTMLElement; cells: HTMLElement[] }[] = [];
  #rowH = 20;
  #labels: ReadonlyMap<number, string> = new Map();
  pc = 0;
  breakpoints = new Set<number>();
  /** in den Phasen hervorgehobene Bytes */
  phaseAddrs = new Set<number>();
  /** verschlüsseltes Programm: Inhalt verbergen */
  masked = false;
  onToggleBreakpoint: (addr: number) => void = () => {};

  constructor(el: HTMLElement) {
    this.#el = el;
    this.#spacer = h('div', { class: 'spacer' });
    el.append(this.#spacer);
    el.addEventListener('scroll', () => this.render(), { passive: true });
    new ResizeObserver(() => { this.#rowH = rowHeight(el, 3); this.render(); }).observe(el);
    el.addEventListener('click', (e) => {
      const t = e.target as HTMLElement;
      const row = t.closest<HTMLElement>('.cv-row');
      if (!row || !(t.classList.contains('c-adr') || t.classList.contains('c-bp'))) return;
      const r = this.#rows[Number(row.dataset['idx'])];
      if (r) this.onToggleBreakpoint(r.instrAddr);
    });
  }

  setRows(rows: CodeRow[], labels: ReadonlyMap<number, string>) {
    this.#rows = rows;
    this.#labels = labels;
    this.#index.fill(-1);
    rows.forEach((r, i) => { this.#index[r.addr] = i; });
    this.render();
  }

  get rows(): readonly CodeRow[] { return this.#rows; }

  /** Beginnt an dieser Adresse eine Befehlszeile? */
  isHead(addr: number): boolean {
    const i = this.#index[addr]!;
    return i >= 0 && this.#rows[i]!.head;
  }

  scrollToAddr(addr: number, force = false) {
    const i = this.#index[addr]!;
    if (i < 0) return;
    const top = i * this.#rowH;
    const { scrollTop, clientHeight } = this.#el;
    if (force || top < scrollTop || top + this.#rowH * 3 > scrollTop + clientHeight) {
      this.#el.scrollTop = Math.max(0, top - this.#rowH * 2);
    }
    this.render();
  }

  render() {
    const total = this.#rows.length;
    this.#spacer.style.height = `${total * this.#rowH}px`;
    const first = Math.max(0, Math.floor(this.#el.scrollTop / this.#rowH) - 2);
    const count = Math.max(0, Math.min(total - first, Math.ceil(this.#el.clientHeight / this.#rowH) + 4));
    while (this.#pool.length < count) {
      const cls = ['c-bp', 'c-adr', 'c-hex', 'c-mn', 'c-asm', 'c-b', 'c-z', 'c-desc'];
      const cells = cls.map((c) => h('span', { class: c }));
      const row = h('div', { class: 'cv-row' }, ...cells);
      this.#el.append(row);
      this.#pool.push({ row, cells });
    }
    const curIdx = this.#index[this.pc]!;
    const curInstr = curIdx >= 0 ? this.#rows[curIdx]!.instrAddr : -1;
    this.#pool.forEach((p, i) => {
      if (i >= count) { p.row.hidden = true; return; }
      const idx = first + i;
      const r = this.#rows[idx]!;
      p.row.hidden = false;
      p.row.dataset['idx'] = String(idx);
      p.row.style.transform = `translateY(${idx * this.#rowH}px)`;
      p.row.classList.toggle('head', r.head);
      p.row.classList.toggle('cur', r.instrAddr === curInstr);
      p.row.classList.toggle('bp', r.head && this.breakpoints.has(r.addr));
      p.row.classList.toggle('phase-hl', this.phaseAddrs.has(r.addr));
      p.row.classList.toggle('data', r.template === 'DB');
      const [, adr, hx, mn, asm, b, z, desc] = p.cells as [HTMLElement, HTMLElement, HTMLElement, HTMLElement, HTMLElement, HTMLElement, HTMLElement, HTMLElement];
      adr.textContent = hex4(r.addr);
      adr.title = r.head ? 'Klick: Haltepunkt setzen/entfernen' : '';
      p.row.classList.toggle('masked', this.masked);
      if (this.masked) {
        hx.textContent = '··';
        mn.textContent = '';
        asm.replaceChildren();
        b.textContent = z.textContent = '';
        desc.textContent = r.addr === this.pc ? 'verschlüsselt – Code nur mit Passwort sichtbar' : '';
        desc.title = '';
        return;
      }
      hx.textContent = hex2(r.byte);
      mn.textContent = r.template;
      const label = r.head ? this.#labels.get(r.addr) : undefined;
      asm.replaceChildren(...(label ? [h('span', { class: 'c-label', text: `${label}: ` })] : []), r.asm);
      b.textContent = r.bytes ? String(r.bytes) : '';
      z.textContent = r.cycles ? String(r.cycles) : '';
      desc.textContent = r.desc;
      desc.title = r.desc;
    });
  }
}
