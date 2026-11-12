import { OPCODES, type OpInfo } from './opcodes.ts';
import { PORT_ADDR, SFR, bitLocation } from './sfr.ts';

export type Space = 'code' | 'iram' | 'sfr' | 'xram';

export interface Access {
  readonly rw: 'r' | 'w';
  readonly space: Space;
  readonly addr: number;
  readonly value: number;
}

export interface StepTrace {
  readonly pc: number;
  readonly opcode: number;
  readonly info: OpInfo;
  readonly cycles: number;
  /** Interrupt-Vektor, falls statt eines Befehls ein Interrupt angesprungen wurde */
  readonly interrupt?: number;
  readonly accesses: readonly Access[];
  /** Kurzbeschreibung der ALU-Operation, z. B. "A + 12h → 34h" */
  readonly alu?: string;
}

export type CpuError = { readonly kind: 'invalid'; readonly pc: number; readonly opcode: number };

const PSW_CY = 0x80, PSW_AC = 0x40, PSW_OV = 0x04, PSW_P = 0x01;

/** Interrupt-Quellen in Abfragereihenfolge (natürliche Priorität) */
const IRQS = [
  { vector: 0x03, enable: 0x01, prio: 0x01, name: 'INT0' },
  { vector: 0x0b, enable: 0x02, prio: 0x02, name: 'Timer 0' },
  { vector: 0x13, enable: 0x04, prio: 0x04, name: 'INT1' },
  { vector: 0x1b, enable: 0x08, prio: 0x08, name: 'Timer 1' },
  { vector: 0x23, enable: 0x10, prio: 0x10, name: 'Seriell' },
] as const;

export const IRQ_NAMES: ReadonlyMap<number, string> = new Map(IRQS.map((i) => [i.vector, i.name]));

const parity = (v: number) => {
  v ^= v >> 4; v ^= v >> 2; v ^= v >> 1;
  return v & 1;
};
const s8 = (v: number) => (v & 0x80 ? v - 0x100 : v);

/**
 * 8051-Kern. Ports sind quasi-bidirektional: PIN = Latch UND externer Pegel.
 * Externe Geräte liefern ihren Pegel über `portInput`.
 */
export class Cpu8051 {
  readonly code = new Uint8Array(0x10000);
  readonly xram = new Uint8Array(0x10000);
  /** 256 Byte int. RAM (obere 128 nur indirekt erreichbar) */
  readonly iram = new Uint8Array(0x100);
  /** SFR-Bereich 80h–FFh */
  readonly sfr = new Uint8Array(0x80);

  pc = 0;
  /** Gesamtzahl Maschinenzyklen seit RESET */
  cycles = 0;
  /** Letzter Wert auf dem Adressbus (für Adress-Puffer/Latch-Anzeige) */
  busAddr = 0;
  /** Steuersignale der letzten Buszugriffe */
  signals = { ale: false, psen: false, rd: false, wr: false };

  /** Externe Pegel je Port (0xFF = niemand zieht auf Low) */
  portInput: (port: number) => number = () => 0xff;
  /** Wird bei jedem Schreiben in ein Port-Latch aufgerufen */
  onPortWrite: ((port: number, value: number) => void) | undefined;
  onSerialTx: ((byte: number) => void) | undefined;

  /** Nur der Modell-Rechner-Befehlssatz ist erlaubt */
  modelOnly = false;
  trace = true;
  #accesses: Access[] = [];
  #alu: string | undefined;

  /** aktive Interrupt-Ebenen (0 = niedrig, 1 = hoch) */
  #irqActive: number[] = [];
  #irqBlock = false;
  #prevP3 = 0xff;
  #txCountdown = 0;
  readonly rxQueue: number[] = [];
  #rxBuf = 0;

  constructor() {
    this.reset();
  }

  reset(clearRam = true): void {
    this.sfr.fill(0);
    if (clearRam) {
      this.iram.fill(0);
    }
    for (const a of PORT_ADDR) this.sfr[a - 0x80] = 0xff;
    this.sfr[SFR.SP - 0x80] = 0x07;
    this.pc = 0;
    this.cycles = 0;
    this.busAddr = 0;
    this.signals = { ale: false, psen: false, rd: false, wr: false };
    this.#irqActive = [];
    this.#irqBlock = false;
    this.#prevP3 = 0xff;
    this.#txCountdown = 0;
    this.#rxBuf = 0;
    this.rxQueue.length = 0;
    for (let p = 0; p < PORT_ADDR.length; p++) this.onPortWrite?.(p, 0xff);
  }

  loadCode(bytes: ReadonlyMap<number, number> | Uint8Array, offset = 0): void {
    this.code.fill(0);
    if (bytes instanceof Uint8Array) this.code.set(bytes, offset);
    else for (const [a, v] of bytes) this.code[a & 0xffff] = v;
  }

  // ───────────────────────── Register-Zugriffe ─────────────────────────
  getSfr(addr: number): number {
    return this.sfr[addr - 0x80]!;
  }
  get acc() { return this.sfr[SFR.ACC - 0x80]!; }
  set acc(v: number) { this.writeSfr(SFR.ACC, v); }
  get b() { return this.sfr[SFR.B - 0x80]!; }
  get psw() { return this.sfr[SFR.PSW - 0x80]!; }
  get sp() { return this.sfr[SFR.SP - 0x80]!; }
  get dptr() { return (this.sfr[SFR.DPH - 0x80]! << 8) | this.sfr[SFR.DPL - 0x80]!; }
  set dptr(v: number) {
    this.writeSfr(SFR.DPH, (v >> 8) & 0xff);
    this.writeSfr(SFR.DPL, v & 0xff);
  }
  get bank() { return (this.psw >> 3) & 3; }
  get cy() { return (this.psw >> 7) & 1; }
  set cy(v: number) { this.#setPswBits(PSW_CY, v ? PSW_CY : 0); }

  #setPswBits(mask: number, value: number) {
    const i = SFR.PSW - 0x80;
    this.sfr[i] = (this.sfr[i]! & ~mask) | (value & mask);
  }

  /** Port-Pegel (Latch UND externe Beschaltung) */
  pin(port: number): number {
    const latch = this.sfr[PORT_ADDR[port]! - 0x80]!;
    return latch & this.portInput(port);
  }
  latch(port: number): number {
    return this.sfr[PORT_ADDR[port]! - 0x80]!;
  }

  #log(rw: 'r' | 'w', space: Space, addr: number, value: number) {
    if (this.trace) this.#accesses.push({ rw, space, addr, value });
  }

  readSfr(addr: number, rmw = false): number {
    const portIdx = (PORT_ADDR as readonly number[]).indexOf(addr);
    let v: number;
    if (portIdx >= 0) v = rmw ? this.latch(portIdx) : this.pin(portIdx);
    else if (addr === SFR.SBUF) v = this.#rxBuf;
    else v = this.sfr[addr - 0x80]!;
    this.#log('r', 'sfr', addr, v);
    return v;
  }

  /** SFR lesen, ohne die Zugriffsspur zu beeinflussen (für die Anzeige) */
  readSfrQuiet(addr: number): number {
    const t = this.trace;
    this.trace = false;
    try { return this.readSfr(addr); } finally { this.trace = t; }
  }

  writeSfr(addr: number, value: number): void {
    value &= 0xff;
    const i = addr - 0x80;
    if (addr === SFR.PSW) {
      this.sfr[i] = (value & ~PSW_P) | parity(this.acc);
    } else if (addr === SFR.ACC) {
      this.sfr[i] = value;
      this.#setPswBits(PSW_P, parity(value));
    } else if (addr === SFR.SBUF) {
      this.#txCountdown = 1040; // ≈ 10 Bit bei 9600 Baud @ 12 MHz
      this.onSerialTx?.(value);
    } else {
      this.sfr[i] = value;
    }
    if (addr === SFR.IE || addr === SFR.IP) this.#irqBlock = true;
    this.#log('w', 'sfr', addr, value);
    const portIdx = (PORT_ADDR as readonly number[]).indexOf(addr);
    if (portIdx >= 0) this.onPortWrite?.(portIdx, value);
  }

  readDirect(addr: number, rmw = false): number {
    if (addr >= 0x80) return this.readSfr(addr, rmw);
    const v = this.iram[addr]!;
    this.#log('r', 'iram', addr, v);
    return v;
  }
  writeDirect(addr: number, value: number): void {
    if (addr >= 0x80) return this.writeSfr(addr, value);
    this.iram[addr] = value & 0xff;
    this.#log('w', 'iram', addr, value & 0xff);
  }
  readIndirect(addr: number): number {
    const v = this.iram[addr & 0xff]!;
    this.#log('r', 'iram', addr & 0xff, v);
    return v;
  }
  writeIndirect(addr: number, value: number): void {
    this.iram[addr & 0xff] = value & 0xff;
    this.#log('w', 'iram', addr & 0xff, value & 0xff);
  }
  regAddr(n: number) { return this.bank * 8 + n; }
  readReg(n: number) { return this.readIndirect(this.regAddr(n)); }
  writeReg(n: number, v: number) { this.writeIndirect(this.regAddr(n), v); }

  readBit(bit: number, rmw = false): number {
    const { byte, bit: n } = bitLocation(bit);
    return (this.readDirect(byte, rmw) >> n) & 1;
  }
  writeBit(bit: number, v: number): void {
    const { byte, bit: n } = bitLocation(bit);
    const cur = byte >= 0x80 ? this.readSfr(byte, true) : this.iram[byte]!;
    this.writeDirect(byte, v ? cur | (1 << n) : cur & ~(1 << n));
  }

  #fetch(): number {
    const v = this.code[this.pc]!;
    this.#log('r', 'code', this.pc, v);
    this.busAddr = this.pc;
    this.pc = (this.pc + 1) & 0xffff;
    return v;
  }

  #push(v: number) {
    const sp = (this.sp + 1) & 0xff;
    this.writeSfr(SFR.SP, sp);
    this.writeIndirect(sp, v);
  }
  #pop(): number {
    const sp = this.sp;
    const v = this.readIndirect(sp);
    this.writeSfr(SFR.SP, (sp - 1) & 0xff);
    return v;
  }
  #pushPc() {
    this.#push(this.pc & 0xff);
    this.#push(this.pc >> 8);
  }

  // ───────────────────────── ALU ─────────────────────────
  #add(a: number, b: number, c: number): number {
    const r = a + b + c;
    const ac = ((a & 0x0f) + (b & 0x0f) + c) > 0x0f;
    const ov = ((a ^ r) & (b ^ r) & 0x80) !== 0;
    this.#setPswBits(PSW_CY | PSW_AC | PSW_OV,
      (r > 0xff ? PSW_CY : 0) | (ac ? PSW_AC : 0) | (ov ? PSW_OV : 0));
    this.#alu = `${h(a)} + ${h(b)}${c ? ' + CY' : ''} → ${h(r & 0xff)}`;
    return r & 0xff;
  }
  #subb(a: number, b: number): number {
    const c = this.cy;
    const r = a - b - c;
    const ac = ((a & 0x0f) - (b & 0x0f) - c) < 0;
    const ov = ((a ^ b) & (a ^ r) & 0x80) !== 0;
    this.#setPswBits(PSW_CY | PSW_AC | PSW_OV,
      (r < 0 ? PSW_CY : 0) | (ac ? PSW_AC : 0) | (ov ? PSW_OV : 0));
    this.#alu = `${h(a)} − ${h(b)}${c ? ' − CY' : ''} → ${h(r & 0xff)}`;
    return r & 0xff;
  }

  // ───────────────────────── Timer / Interrupts ─────────────────────────
  #timerTick(cycles: number) {
    const tmod = this.getSfr(SFR.TMOD);
    let tcon = this.getSfr(SFR.TCON);
    const p3 = this.pin(3);
    for (let t = 0; t < 2; t++) {
      const cfg = (tmod >> (t * 4)) & 0x0f;
      const mode = cfg & 3;
      const counter = (cfg & 4) !== 0;
      const gate = (cfg & 8) !== 0;
      const tr = (tcon >> (4 + t * 2)) & 1;
      const intPin = (p3 >> (2 + t)) & 1;
      const run = tr && (!gate || intPin);
      if (t === 1 && mode === 3) continue; // Timer 1 in Mode 3 steht
      let inc = 0;
      if (counter) {
        const tPin = (p3 >> (4 + t)) & 1;
        const prev = (this.#prevP3 >> (4 + t)) & 1;
        if (run && prev && !tPin) inc = 1;
      } else if (run) inc = cycles;
      if (inc) tcon = this.#timerAdd(t, mode, inc, tcon, t === 1 && (tmod & 3) === 3);

      // Timer 0 Mode 3: TH0 läuft als 8-Bit-Timer mit TR1/TF1
      if (t === 0 && mode === 3 && (tcon & 0x40)) {
        const th = this.getSfr(SFR.TH0) + cycles;
        if (th > 0xff) tcon |= 0x80;
        this.sfr[SFR.TH0 - 0x80] = th & 0xff;
      }
    }
    this.sfr[SFR.TCON - 0x80] = tcon;
  }

  #timerAdd(t: number, mode: number, inc: number, tcon: number, noFlag: boolean): number {
    const TL = t ? SFR.TL1 : SFR.TL0, TH = t ? SFR.TH1 : SFR.TH0;
    const tf = t ? 0x80 : 0x20;
    let tl = this.getSfr(TL), th = this.getSfr(TH);
    let overflow = false;
    switch (mode) {
      case 0: { // 13 Bit: TH 8 Bit + TL 5 Bit
        let v = ((th << 5) | (tl & 0x1f)) + inc;
        if (v > 0x1fff) { overflow = true; v &= 0x1fff; }
        th = v >> 5; tl = (tl & 0xe0) | (v & 0x1f);
        break;
      }
      case 1: {
        let v = ((th << 8) | tl) + inc;
        if (v > 0xffff) { overflow = true; v &= 0xffff; }
        th = v >> 8; tl = v & 0xff;
        break;
      }
      case 2: {
        let v = tl + inc;
        while (v > 0xff) { overflow = true; v = v - 0x100 + th; }
        tl = v;
        break;
      }
      case 3: { // nur TL0 (für Timer 0)
        let v = tl + inc;
        if (v > 0xff) { overflow = true; v &= 0xff; }
        tl = v;
        break;
      }
    }
    this.sfr[TL - 0x80] = tl;
    this.sfr[TH - 0x80] = th;
    return overflow && !noFlag ? tcon | tf : tcon;
  }

  #sampleExternal() {
    const p3 = this.pin(3);
    let tcon = this.getSfr(SFR.TCON);
    for (let i = 0; i < 2; i++) {
      const pinNow = (p3 >> (2 + i)) & 1;
      const pinPrev = (this.#prevP3 >> (2 + i)) & 1;
      const it = (tcon >> (i * 2)) & 1;
      const ieMask = 0x02 << (i * 2);
      if (it) { if (pinPrev && !pinNow) tcon |= ieMask; } else tcon = pinNow ? tcon & ~ieMask : tcon | ieMask;
    }
    this.sfr[SFR.TCON - 0x80] = tcon;
    this.#prevP3 = p3;
  }

  #serialTick(cycles: number) {
    if (this.#txCountdown > 0) {
      this.#txCountdown -= cycles;
      if (this.#txCountdown <= 0) this.sfr[SFR.SCON - 0x80]! |= 0x02;
    }
    const scon = this.getSfr(SFR.SCON);
    if ((scon & 0x10) && !(scon & 0x01) && this.rxQueue.length) {
      this.#rxBuf = this.rxQueue.shift()!;
      this.sfr[SFR.SCON - 0x80] = scon | 0x01;
    }
  }

  /** Liefert die nächste anstehende Interrupt-Quelle oder undefined */
  pendingIrq(): (typeof IRQS)[number] | undefined {
    const ie = this.getSfr(SFR.IE);
    if (!(ie & 0x80)) return undefined;
    const ip = this.getSfr(SFR.IP);
    const tcon = this.getSfr(SFR.TCON);
    const scon = this.getSfr(SFR.SCON);
    const flags = [tcon & 0x02, tcon & 0x20, tcon & 0x08, tcon & 0x80, scon & 0x03];
    const active = this.#irqActive.at(-1);
    let best: (typeof IRQS)[number] | undefined;
    let bestLvl = -1;
    IRQS.forEach((irq, i) => {
      if (!(ie & irq.enable) || !flags[i]) return;
      const lvl = ip & irq.prio ? 1 : 0;
      if (active !== undefined && lvl <= active) return;
      if (lvl > bestLvl) { best = irq; bestLvl = lvl; }
    });
    return best;
  }

  #enterIrq(): StepTrace | undefined {
    if (this.#irqBlock) { this.#irqBlock = false; return undefined; }
    const irq = this.pendingIrq();
    if (!irq) return undefined;
    const pc = this.pc;
    const ip = this.getSfr(SFR.IP);
    this.#irqActive.push(ip & irq.prio ? 1 : 0);
    // Flags löschen (Flanken-INTs und Timer); seriell muss die Software löschen
    let tcon = this.getSfr(SFR.TCON);
    if (irq.vector === 0x03 && (tcon & 0x01)) tcon &= ~0x02;
    if (irq.vector === 0x13 && (tcon & 0x04)) tcon &= ~0x08;
    if (irq.vector === 0x0b) tcon &= ~0x20;
    if (irq.vector === 0x1b) tcon &= ~0x80;
    this.sfr[SFR.TCON - 0x80] = tcon;
    this.#pushPc();
    this.pc = irq.vector;
    return this.#finish(pc, 0x12, 2, irq.vector);
  }

  #finish(pc: number, opcode: number, cycles: number, interrupt?: number): StepTrace {
    this.cycles += cycles;
    this.#timerTick(cycles);
    this.#serialTick(cycles);
    this.#sampleExternal();
    const trace: StepTrace = {
      pc, opcode, info: OPCODES[opcode]!, cycles,
      accesses: this.#accesses,
      ...(interrupt === undefined ? {} : { interrupt }),
      ...(this.#alu === undefined ? {} : { alu: this.#alu }),
    };
    this.#accesses = [];
    this.#alu = undefined;
    return trace;
  }

  /** Führt einen Befehl (oder einen Interrupt-Einsprung) aus. */
  step(): StepTrace | CpuError {
    this.signals = { ale: true, psen: true, rd: false, wr: false };
    const irq = this.#enterIrq();
    if (irq) return irq;
    const pc = this.pc;
    const opcode = this.#fetch();
    const info = OPCODES[opcode]!;
    if (!info.valid || (this.modelOnly && !info.model)) {
      this.pc = pc;
      this.#accesses = [];
      return { kind: 'invalid', pc, opcode };
    }
    this.#exec(opcode);
    return this.#finish(pc, opcode, info.cycles);
  }

  #rel(rel: number) {
    this.pc = (this.pc + s8(rel)) & 0xffff;
  }

  #exec(o: number): void {
    const lo = o & 0x0f;
    const hi = o >> 4;

    // Spalte 1: AJMP / ACALL
    if (lo === 1) {
      const a = this.#fetch();
      const target = (this.pc & 0xf800) | ((o >> 5) << 8) | a;
      if (hi & 1) this.#pushPc();
      this.pc = target;
      return;
    }

    // Quelle für Spalten 4..F (#, dadr, @Ri, Rn) lesen
    const srcRead = (rmw = false): number => {
      if (lo === 4) return this.#fetch();
      if (lo === 5) return this.readDirect(this.#fetch(), rmw);
      if (lo <= 7) return this.readIndirect(this.readReg(lo - 6));
      return this.readReg(lo - 8);
    };
    // Zieladresse/Schreibfunktion für Spalten 5..F
    const dstAccess = (): { read: (rmw?: boolean) => number; write: (v: number) => void } => {
      if (lo === 5) {
        const a = this.#fetch();
        return { read: (rmw = true) => this.readDirect(a, rmw), write: (v) => this.writeDirect(a, v) };
      }
      if (lo <= 7) {
        const a = this.readReg(lo - 6);
        return { read: () => this.readIndirect(a), write: (v) => this.writeIndirect(a, v) };
      }
      return { read: () => this.readReg(lo - 8), write: (v) => this.writeReg(lo - 8, v) };
    };

    if (lo >= 4) {
      switch (hi) {
        case 0x0: // INC
          if (lo === 4) { this.acc = (this.acc + 1) & 0xff; this.#alu = `A + 1 → ${h(this.acc)}`; } else {
            const d = dstAccess(); const v = (d.read(true) + 1) & 0xff; d.write(v); this.#alu = `+1 → ${h(v)}`;
          }
          return;
        case 0x1: // DEC
          if (lo === 4) { this.acc = (this.acc - 1) & 0xff; this.#alu = `A − 1 → ${h(this.acc)}`; } else {
            const d = dstAccess(); const v = (d.read(true) - 1) & 0xff; d.write(v); this.#alu = `−1 → ${h(v)}`;
          }
          return;
        case 0x2: this.acc = this.#add(this.acc, srcRead(), 0); return;
        case 0x3: this.acc = this.#add(this.acc, srcRead(), this.cy); return;
        case 0x4: { const s = srcRead(); const r = this.acc | s; this.#alu = `${h(this.acc)} ODER ${h(s)} → ${h(r)}`; this.acc = r; return; }
        case 0x5: { const s = srcRead(); const r = this.acc & s; this.#alu = `${h(this.acc)} UND ${h(s)} → ${h(r)}`; this.acc = r; return; }
        case 0x6: { const s = srcRead(); const r = this.acc ^ s; this.#alu = `${h(this.acc)} XOR ${h(s)} → ${h(r)}`; this.acc = r; return; }
        case 0x7: // MOV x,#data
          if (lo === 4) { this.acc = this.#fetch(); return; }
          { const d = dstAccess(); d.write(this.#fetch()); }
          return;
        case 0x8:
          if (lo === 4) { // DIV AB
            const a = this.acc, b = this.b;
            if (b === 0) { this.#setPswBits(PSW_CY | PSW_OV, PSW_OV); this.#alu = `${h(a)} : 0 → Überlauf`; return; }
            this.acc = Math.trunc(a / b);
            this.writeSfr(SFR.B, a % b);
            this.#setPswBits(PSW_CY | PSW_OV, 0);
            this.#alu = `${h(a)} : ${h(b)} → ${h(this.acc)} Rest ${h(a % b)}`;
            return;
          }
          if (lo === 5) { // MOV dadr,dadr (Quelle zuerst kodiert)
            const src = this.#fetch(); const dst = this.#fetch();
            this.writeDirect(dst, this.readDirect(src));
            return;
          }
          { const v = srcRead(); this.writeDirect(this.#fetch(), v); }
          return;
        case 0x9: this.acc = this.#subb(this.acc, srcRead()); return;
        case 0xa:
          if (lo === 4) { // MUL AB
            const r = this.acc * this.b;
            this.#alu = `${h(this.acc)} × ${h(this.b)} → ${r.toString(16).toUpperCase().padStart(4, '0')}h`;
            this.acc = r & 0xff;
            this.writeSfr(SFR.B, r >> 8);
            this.#setPswBits(PSW_CY | PSW_OV, r > 0xff ? PSW_OV : 0);
            return;
          }
          { // MOV @Ri/Rn,dadr
            const a = this.#fetch();
            const v = this.readDirect(a);
            if (lo <= 7) this.writeIndirect(this.readReg(lo - 6), v); else this.writeReg(lo - 8, v);
          }
          return;
        case 0xb: { // CJNE
          let x: number, y: number;
          if (lo === 4) { x = this.acc; y = this.#fetch(); }
          else if (lo === 5) { x = this.acc; y = this.readDirect(this.#fetch()); }
          else if (lo <= 7) { x = this.readIndirect(this.readReg(lo - 6)); y = this.#fetch(); }
          else { x = this.readReg(lo - 8); y = this.#fetch(); }
          const rel = this.#fetch();
          this.cy = x < y ? 1 : 0;
          this.#alu = `${h(x)} ${x === y ? '=' : '≠'} ${h(y)}`;
          if (x !== y) this.#rel(rel);
          return;
        }
        case 0xc:
          if (lo === 4) { const a = this.acc; this.acc = ((a << 4) | (a >> 4)) & 0xff; this.#alu = `SWAP ${h(a)} → ${h(this.acc)}`; return; }
          { const d = dstAccess(); const v = d.read(false); d.write(this.acc); this.acc = v; }
          return;
        case 0xd:
          if (lo === 4) { this.#da(); return; }
          if (lo === 5) {
            const a = this.#fetch(); const rel = this.#fetch();
            const v = (this.readDirect(a, true) - 1) & 0xff; this.writeDirect(a, v);
            this.#alu = `−1 → ${h(v)}`;
            if (v) this.#rel(rel);
            return;
          }
          if (lo <= 7) { // XCHD
            const a = this.readReg(lo - 6); const m = this.readIndirect(a); const acc = this.acc;
            this.writeIndirect(a, (m & 0xf0) | (acc & 0x0f));
            this.acc = (acc & 0xf0) | (m & 0x0f);
            return;
          }
          { // DJNZ Rn
            const rel = this.#fetch(); const v = (this.readReg(lo - 8) - 1) & 0xff; this.writeReg(lo - 8, v);
            this.#alu = `−1 → ${h(v)}`;
            if (v) this.#rel(rel);
          }
          return;
        case 0xe:
          if (lo === 4) { this.acc = 0; return; }
          this.acc = srcRead();
          return;
        case 0xf:
          if (lo === 4) { this.acc = ~this.acc & 0xff; this.#alu = `NICHT → ${h(this.acc)}`; return; }
          { const d = dstAccess(); d.write(this.acc); }
          return;
      }
    }

    switch (o) {
      case 0x00: return;
      case 0x02: { const hiB = this.#fetch(); const loB = this.#fetch(); this.pc = (hiB << 8) | loB; return; }
      case 0x03: { const a = this.acc; this.acc = ((a >> 1) | (a << 7)) & 0xff; this.#alu = `RR ${h(a)} → ${h(this.acc)}`; return; }
      case 0x13: { const a = this.acc; const c = this.cy; this.cy = a & 1; this.acc = (a >> 1) | (c << 7); this.#alu = `RRC ${h(a)} → ${h(this.acc)}`; return; }
      case 0x23: { const a = this.acc; this.acc = ((a << 1) | (a >> 7)) & 0xff; this.#alu = `RL ${h(a)} → ${h(this.acc)}`; return; }
      case 0x33: { const a = this.acc; const c = this.cy; this.cy = a >> 7; this.acc = ((a << 1) | c) & 0xff; this.#alu = `RLC ${h(a)} → ${h(this.acc)}`; return; }
      case 0x10: case 0x20: case 0x30: { // JBC / JB / JNB
        const bit = this.#fetch(); const rel = this.#fetch();
        const v = this.readBit(bit, o === 0x10);
        if (o === 0x10) { if (v) { this.writeBit(bit, 0); this.#rel(rel); } }
        else if ((o === 0x20) === (v === 1)) this.#rel(rel);
        return;
      }
      case 0x12: { const hiB = this.#fetch(); const loB = this.#fetch(); this.#pushPc(); this.pc = (hiB << 8) | loB; return; }
      case 0x22: case 0x32: {
        const hiB = this.#pop(); const loB = this.#pop();
        this.pc = (hiB << 8) | loB;
        if (o === 0x32) { this.#irqActive.pop(); this.#irqBlock = true; }
        return;
      }
      case 0x40: { const r = this.#fetch(); if (this.cy) this.#rel(r); return; }
      case 0x50: { const r = this.#fetch(); if (!this.cy) this.#rel(r); return; }
      case 0x60: { const r = this.#fetch(); if (this.acc === 0) this.#rel(r); return; }
      case 0x70: { const r = this.#fetch(); if (this.acc !== 0) this.#rel(r); return; }
      case 0x80: { const r = this.#fetch(); this.#rel(r); return; }
      case 0x42: case 0x52: case 0x62: case 0x43: case 0x53: case 0x63: {
        const a = this.#fetch();
        const cur = this.readDirect(a, true);
        const v = o & 1 ? this.#fetch() : this.acc;
        const r = o < 0x50 ? cur | v : o < 0x60 ? cur & v : cur ^ v;
        this.#alu = `${h(cur)} ${o < 0x50 ? 'ODER' : o < 0x60 ? 'UND' : 'XOR'} ${h(v)} → ${h(r)}`;
        this.writeDirect(a, r);
        return;
      }
      case 0x72: { const b = this.readBit(this.#fetch()); this.cy = this.cy | b; return; }
      case 0x82: { const b = this.readBit(this.#fetch()); this.cy = this.cy & b; return; }
      case 0xa0: { const b = this.readBit(this.#fetch()); this.cy = this.cy | (b ^ 1); return; }
      case 0xb0: { const b = this.readBit(this.#fetch()); this.cy = this.cy & (b ^ 1); return; }
      case 0x73: this.pc = (this.acc + this.dptr) & 0xffff; return;
      case 0x83: case 0x93: {
        const base = o === 0x83 ? this.pc : this.dptr;
        const addr = (this.acc + base) & 0xffff;
        const v = this.code[addr]!;
        this.#log('r', 'code', addr, v);
        this.busAddr = addr;
        this.acc = v;
        return;
      }
      case 0x90: { const hiB = this.#fetch(); const loB = this.#fetch(); this.dptr = (hiB << 8) | loB; return; }
      case 0x92: this.writeBit(this.#fetch(), this.cy); return;
      case 0xa2: this.cy = this.readBit(this.#fetch()); return;
      case 0xa3: this.dptr = (this.dptr + 1) & 0xffff; return;
      case 0xb2: { const b = this.#fetch(); this.writeBit(b, this.readBit(b, true) ^ 1); return; }
      case 0xb3: this.cy = this.cy ^ 1; return;
      case 0xc0: this.#push(this.readDirect(this.#fetch())); return;
      case 0xd0: { const a = this.#fetch(); this.writeDirect(a, this.#pop()); return; }
      case 0xc2: this.writeBit(this.#fetch(), 0); return;
      case 0xd2: this.writeBit(this.#fetch(), 1); return;
      case 0xc3: this.cy = 0; return;
      case 0xd3: this.cy = 1; return;
      case 0xe0: case 0xe2: case 0xe3: {
        const addr = o === 0xe0 ? this.dptr : (this.getSfr(SFR.P2) << 8) | this.readReg(o - 0xe2);
        const v = this.xram[addr]!;
        this.#log('r', 'xram', addr, v);
        this.busAddr = addr;
        this.signals = { ale: true, psen: true, rd: true, wr: false };
        this.acc = v;
        return;
      }
      case 0xf0: case 0xf2: case 0xf3: {
        const addr = o === 0xf0 ? this.dptr : (this.getSfr(SFR.P2) << 8) | this.readReg(o - 0xf2);
        this.xram[addr] = this.acc;
        this.#log('w', 'xram', addr, this.acc);
        this.busAddr = addr;
        this.signals = { ale: true, psen: true, rd: false, wr: true };
        return;
      }
    }
  }

  #da() {
    let a = this.acc;
    const before = a;
    let cy = this.cy;
    if ((a & 0x0f) > 9 || (this.psw & PSW_AC)) {
      a += 6;
      if (a > 0xff) cy = 1;
      a &= 0xff;
    }
    if ((a >> 4) > 9 || cy) {
      a += 0x60;
      if (a > 0xff) cy = 1;
      a &= 0xff;
    }
    this.acc = a;
    this.cy = cy;
    this.#alu = `DA ${h(before)} → ${h(a)}`;
  }
}

const h = (v: number) => `${v.toString(16).toUpperCase().padStart(2, '0')}h`;

export const isError = (r: StepTrace | CpuError): r is CpuError => 'kind' in r;
