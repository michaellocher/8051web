/**
 * Fenster „interne RAM-Daten" und „interne SFR-Daten" wie im Original.
 * Ein Klick ins Fenster schaltet auf die Namensansicht (Registerbänke, Bitbereich, TOS bzw. SFR-Namen) um.
 */
import type { Cpu8051 } from '../core/cpu.ts';
import { SFR_NAMES, hex2 } from '../core/sfr.ts';
import { $ } from './dom.ts';
import { makeWindow, openWindow } from './winutil.ts';

type Kind = 'iram' | 'sfr';

export class MemoryWindows {
  readonly #cpu: Cpu8051;
  readonly #names: Record<Kind, boolean> = { iram: false, sfr: false };
  readonly #wins: Record<Kind, HTMLElement>;

  constructor(cpu: Cpu8051) {
    this.#cpu = cpu;
    this.#wins = { iram: $('[data-window="iram"]'), sfr: $('[data-window="sfr"]') };
    makeWindow(this.#wins.iram, { left: 40, top: 110 });
    makeWindow(this.#wins.sfr, { left: 460, top: 140 });
    for (const kind of ['iram', 'sfr'] as const) {
      $(`[data-memview="${kind}"]`).addEventListener('click', () => {
        this.#names[kind] = !this.#names[kind];
        this.render();
      });
    }
  }

  open(kind: Kind) {
    openWindow(this.#wins[kind]);
    this.render();
  }

  render() {
    for (const kind of ['iram', 'sfr'] as const) {
      const win = this.#wins[kind];
      if (win.hidden) continue;
      const names = this.#names[kind];
      win.querySelector('[data-memtitle]')!.textContent = `interne ${kind === 'iram' ? 'RAM' : 'SFR'}-${names ? 'Namen' : 'Daten'}`;
      const view = win.querySelector<HTMLElement>('[data-memview]')!;
      const html = kind === 'iram' ? (names ? this.#iramNames() : this.#iramData()) : (names ? this.#sfrNames() : this.#sfrData());
      if (view.innerHTML !== html) view.innerHTML = html;
    }
  }

  #head(ascii: boolean) {
    return `<b class="mv-h">Adr  +0 +1 +2 +3 +4 +5 +6 +7${ascii ? '  ASCII' : ''}</b>\n`;
  }

  #iramData(): string {
    let out = this.#head(true);
    const sp = this.#cpu.sp;
    for (let r = 0; r < 32; r++) {
      const bytes = Array.from({ length: 8 }, (_, c) => {
        const a = r * 8 + c;
        const v = hex2(this.#cpu.iram[a]!);
        return a === sp ? `<span class="mv-tos">${v}</span>` : v;
      });
      const ascii = Array.from({ length: 8 }, (_, c) => {
        const v = this.#cpu.iram[r * 8 + c]!;
        return v >= 0x20 && v < 0x7f ? escape(String.fromCharCode(v)) : '.';
      }).join('');
      out += `<b>${hex2(r * 8)}</b>   ${bytes.join(' ')}  ${ascii}\n`;
    }
    return out;
  }

  #iramNames(): string {
    const sp = this.#cpu.sp;
    const bank = this.#cpu.bank;
    let out = this.#head(false);
    for (let r = 0; r < 32; r++) {
      const base = r * 8;
      let line: string;
      if (base < 0x20) {
        const regs = Array.from({ length: 8 }, (_, c) => (base + c === sp ? '<span class="mv-tos">TOS</span>' : `R${c} `)).join('');
        line = `${regs} <span class="${r === bank ? 'mv-active' : 'mv-note'}">Bank-${r}</span>`;
      } else if (base === 0x20) line = '<span class="mv-note">bitadressierbarer Bereich</span>';
      else if (base === 0x28) line = '<span class="mv-note">    bis Adresse 2Fh</span>';
      else if (base === 0x80) line = '<span class="mv-note">nur indirekt adressierbarer</span>';
      else if (base === 0x88) line = '<span class="mv-note"> Bereich  bis Adresse FFh</span>';
      else line = sp >= base && sp < base + 8 ? `${'   '.repeat(sp - base)}<span class="mv-tos">TOS</span>` : '';
      out += `<b>${hex2(base)}</b>   ${line}\n`;
    }
    return out;
  }

  #sfrData(): string {
    let out = this.#head(false);
    for (let r = 0; r < 16; r++) {
      const base = 0x80 + r * 8;
      const bytes = Array.from({ length: 8 }, (_, c) => hex2(this.#cpu.getSfr(base + c))); // Ports: Latch
      out += `<b>${hex2(base)}</b>   ${bytes.join(' ')}\n`;
    }
    return `${out}<span class="mv-note">Bei den Port-Registern steht der Zustand des Port-Latch.</span>\n`;
  }

  #sfrNames(): string {
    let out = this.#head(false);
    for (let r = 0; r < 16; r++) {
      const base = 0x80 + r * 8;
      const cells = Array.from({ length: 8 }, (_, c) => (SFR_NAMES.get(base + c) ?? '').padEnd(5));
      out += `<b>${hex2(base)}</b>   <span class="mv-note">${cells.join(' ').trimEnd()}</span>\n`;
    }
    return out;
  }
}

const escape = (c: string) => (c === '<' ? '&lt;' : c === '>' ? '&gt;' : c === '&' ? '&amp;' : c);
