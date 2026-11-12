import type { AsmDiagnostic } from '../core/asm.ts';
import { $, h } from './dom.ts';

/** Schlichter Assembler-Editor mit Zeilennummern und Fehlerliste. */
export class Editor {
  readonly dialog: HTMLDialogElement;
  readonly #ta: HTMLTextAreaElement;
  readonly #gutter: HTMLElement;
  readonly #diag: HTMLElement;
  #errors = new Set<number>();
  onChange: (src: string) => void = () => {};
  onAssemble: () => void = () => {};

  constructor(dialog: HTMLDialogElement) {
    this.dialog = dialog;
    this.#ta = $<HTMLTextAreaElement>('[data-editor]', dialog);
    this.#gutter = $('[data-gutter]', dialog);
    this.#diag = $('[data-diag]', dialog);
    this.#ta.addEventListener('input', () => { this.#errors.clear(); this.#renderGutter(); this.onChange(this.#ta.value); });
    this.#ta.addEventListener('scroll', () => { this.#gutter.scrollTop = this.#ta.scrollTop; });
    this.#ta.addEventListener('keydown', (e) => {
      if (e.key === 'Tab' && !e.shiftKey) {
        e.preventDefault();
        this.#ta.setRangeText('\t', this.#ta.selectionStart, this.#ta.selectionEnd, 'end');
        this.onChange(this.#ta.value);
      } else if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) {
        e.preventDefault();
        this.onAssemble();
      }
    });
    this.#diag.addEventListener('click', (e) => {
      const line = (e.target as HTMLElement).closest<HTMLElement>('[data-line]')?.dataset['line'];
      if (line) this.gotoLine(Number(line));
    });
  }

  get value() { return this.#ta.value; }
  set value(v: string) {
    this.#ta.value = v;
    this.#errors.clear();
    this.#renderGutter();
  }

  open() {
    if (!this.dialog.open) this.dialog.showModal();
    this.#renderGutter();
    this.#ta.focus();
  }

  showDiagnostics(errors: readonly AsmDiagnostic[], summary: string) {
    this.#errors = new Set(errors.map((e) => e.line));
    this.#renderGutter();
    this.#diag.replaceChildren(
      ...(errors.length
        ? errors.map((e) => h('button', { 'data-line': String(e.line), text: `Zeile ${e.line}: ${e.message}` }))
        : [h('span', { class: 'ok', text: summary })]),
    );
  }

  gotoLine(line: number) {
    const lines = this.#ta.value.split('\n');
    const start = lines.slice(0, line - 1).reduce((n, l) => n + l.length + 1, 0);
    this.#ta.focus();
    this.#ta.setSelectionRange(start, start + (lines[line - 1]?.length ?? 0));
    const lh = parseFloat(getComputedStyle(this.#ta).lineHeight) || 19;
    this.#ta.scrollTop = Math.max(0, (line - 5) * lh);
  }

  #renderGutter() {
    const n = this.#ta.value.split('\n').length;
    const frag = document.createDocumentFragment();
    for (let i = 1; i <= n; i++) {
      frag.append(this.#errors.has(i) ? h('span', { class: 'err', text: String(i) }) : String(i), '\n');
    }
    this.#gutter.replaceChildren(frag);
    this.#gutter.scrollTop = this.#ta.scrollTop;
  }
}
