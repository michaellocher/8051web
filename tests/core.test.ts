import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { readFile, glob } from 'node:fs/promises';
import { join } from 'node:path';
import { Cpu8051, isError, type StepTrace } from '../src/core/cpu.ts';
import { assemble } from '../src/core/asm.ts';
import { OPCODES } from '../src/core/opcodes.ts';
import { decodeAt } from '../src/core/disasm.ts';
import { parseIntelHex, toIntelHex } from '../src/core/hex.ts';
import { SFR } from '../src/core/sfr.ts';
import { parseMeta } from '../src/core/meta.ts';

function run(src: string, steps = 1000, setup?: (cpu: Cpu8051) => void) {
  const r = assemble(src);
  assert.deepEqual(r.errors, [], `Assembler-Fehler: ${JSON.stringify(r.errors)}`);
  const cpu = new Cpu8051();
  cpu.loadCode(r.bytes);
  setup?.(cpu);
  for (let i = 0; i < steps; i++) {
    const t = cpu.step();
    if (isError(t)) assert.fail(`Ungültiger Opcode ${t.opcode.toString(16)} bei ${t.pc.toString(16)}`);
  }
  return cpu;
}

describe('Opcode-Tabelle', () => {
  it('deckt alle 256 Opcodes ab, nur A5h ist ungültig', () => {
    assert.equal(OPCODES.length, 256);
    assert.deepEqual(OPCODES.filter((o) => !o.valid).map((o) => o.opcode), [0xa5]);
  });
  it('hat für jeden gültigen Befehl eine Beschreibung', () => {
    const missing = OPCODES.filter((o) => o.valid && !o.desc).map((o) => o.template);
    assert.deepEqual(missing, []);
  });
  it('stimmt bei Byte- und Zykluszahlen mit dem Datenblatt überein', () => {
    const check: [number, number, number][] = [
      [0x00, 1, 1], [0x02, 3, 2], [0x75, 3, 2], [0x85, 3, 2], [0x90, 3, 2], [0xa4, 1, 4], [0x84, 1, 4],
      [0xb4, 3, 2], [0xd5, 3, 2], [0xd8, 2, 2], [0x43, 3, 2], [0x42, 2, 1], [0xe5, 2, 1], [0xf5, 2, 1],
      [0x92, 2, 2], [0xa2, 2, 1], [0xb2, 2, 1], [0x10, 3, 2], [0x11, 2, 2], [0xa3, 1, 2], [0x78, 2, 1],
    ];
    for (const [o, b, c] of check) {
      assert.equal(OPCODES[o]!.bytes, b, `Bytes ${o.toString(16)}`);
      assert.equal(OPCODES[o]!.cycles, c, `Zyklen ${o.toString(16)}`);
    }
  });
  it('Assembler und Disassembler sind zueinander invers (alle Opcodes)', () => {
    for (const info of OPCODES.filter((o) => o.valid)) {
      const code = new Uint8Array(0x10000);
      // Operanden 0x20 / 0x30 ergeben gültige Adressen/Bits; rel=0
      code.set([info.opcode, 0x30, 0x20], 0x100);
      const ins = decodeAt(code, 0x100);
      const r = assemble(`ORG 100h\n${ins.asm}`);
      assert.deepEqual(r.errors, [], `${info.template}: ${ins.asm}`);
      const out = [...r.bytes.values()];
      assert.deepEqual(out, [...code.subarray(0x100, 0x100 + info.bytes)], `${info.template}: ${ins.asm}`);
    }
  });
});

describe('Disassembler', () => {
  it('erzeugt Beschreibungen wie im Original', () => {
    const code = new Uint8Array(0x10000);
    code.set([0x75, 0x80, 0xe0, 0x20, 0x87, 0x08]);
    const mov = decodeAt(code, 0);
    assert.equal(mov.info.template, 'MOV dadr,#const8');
    assert.equal(mov.asm, 'MOV P0,#0E0h');
    assert.equal(mov.rows[1]!.desc, 'Adresse im int. RAM ( P0 )');
    assert.equal(mov.rows[2]!.desc, '8-Bit-Konstante ( = E0h = 224d = 11100000b )');
    const jb = decodeAt(code, 3);
    assert.equal(jb.asm, 'JB P0.7,000Eh');
    assert.equal(jb.rows[1]!.desc, 'Bit-Adresse im int. RAM ( P0.7 )');
    assert.equal(OPCODES[0x7a]!.template, 'MOV R2,#const8');
    assert.equal(OPCODES[0x7a]!.desc, 'Lade R2 mit 8-Bit-Konstante');
  });
});

describe('Intel-HEX', () => {
  it('liest und schreibt symmetrisch', () => {
    const data = new Map([[0, 0x02], [1, 0x00], [2, 0x30], [0x30, 0x80], [0x31, 0xfe]]);
    const text = toIntelHex(data);
    assert.match(text, /^:03000000020030CB$/m);
    assert.deepEqual(parseIntelHex(text).data, data);
  });
  it('erkennt Prüfsummenfehler', () => {
    assert.throws(() => parseIntelHex(':03000000020030CC\n'), /Prüfsumme/);
  });
});

describe('CPU', () => {
  it('ADD setzt CY, AC, OV und Parität', () => {
    const cpu = run('MOV A,#7Fh\nADD A,#01h', 2);
    assert.equal(cpu.acc, 0x80);
    assert.equal(cpu.psw & 0x80, 0, 'CY');
    assert.equal(cpu.psw & 0x40, 0x40, 'AC');
    assert.equal(cpu.psw & 0x04, 0x04, 'OV');
    assert.equal(cpu.psw & 0x01, 1, 'P');
  });
  it('SUBB mit Borrow', () => {
    const cpu = run('MOV A,#10h\nSETB C\nSUBB A,#20h', 3);
    assert.equal(cpu.acc, 0xef);
    assert.equal(cpu.cy, 1);
  });
  it('DA A korrigiert BCD-Addition', () => {
    const cpu = run('MOV A,#38h\nADD A,#29h\nDA A', 3);
    assert.equal(cpu.acc, 0x67);
  });
  it('MUL und DIV', () => {
    let cpu = run('MOV A,#50h\nMOV B,#0A0h\nMUL AB', 3);
    assert.equal(cpu.acc, 0x00); assert.equal(cpu.b, 0x32); assert.equal(cpu.psw & 0x04, 0x04);
    cpu = run('MOV A,#251\nMOV B,#18\nDIV AB', 3);
    assert.equal(cpu.acc, 13); assert.equal(cpu.b, 17);
  });
  it('Registerbänke, Stack, LCALL/RET', () => {
    const cpu = run(`
      MOV SP,#2Fh
      MOV PSW,#08h
      MOV R0,#55h
      LCALL sub
      SJMP $
sub:  MOV A,R0
      RET`, 6);
    assert.equal(cpu.iram[0x08], 0x55);
    assert.equal(cpu.acc, 0x55);
    assert.equal(cpu.sp, 0x2f);
  });
  it('Bitbefehle auf int. RAM und SFR', () => {
    const cpu = run('SETB 20h.3\nSETB ACC.7\nMOV C,20h.3\nCPL P1.0\nJBC 20h.3,ok\nNOP\nok: NOP', 6);
    assert.equal(cpu.iram[0x20], 0x00);
    assert.equal(cpu.acc, 0x80);
    assert.equal(cpu.cy, 1);
    assert.equal(cpu.latch(1), 0xfe);
  });
  it('Port-Pins: Latch UND externe Beschaltung', () => {
    const cpu = run('MOV A,P1\nMOV R0,A\nANL P1,#0F0h', 3, (c) => { c.portInput = (p) => (p === 1 ? 0x0f : 0xff); });
    assert.equal(cpu.iram[0], 0x0f, 'Lesen liefert Pins');
    assert.equal(cpu.latch(1), 0xf0, 'Read-Modify-Write nutzt das Latch');
  });
  it('Timer 0 Mode 1 läuft über und löst Interrupt aus', () => {
    const src = `
      ORG 0
      LJMP main
      ORG 0Bh
      INC R2
      RETI
      ORG 30h
main: MOV TMOD,#01h
      MOV TH0,#0FFh
      MOV TL0,#0F0h
      SETB ET0
      SETB EA
      SETB TR0
      SJMP $`;
    const cpu = run(src, 40);
    assert.equal(cpu.iram[2], 1);
    assert.equal(cpu.getSfr(SFR.TCON) & 0x20, 0, 'TF0 von Hardware gelöscht');
  });
  it('Timer 1 Mode 2 Auto-Reload', () => {
    const cpu = run('MOV TMOD,#20h\nMOV TH1,#0F0h\nMOV TL1,#0F0h\nSETB TR1\nSJMP $', 20);
    assert.ok(cpu.getSfr(SFR.TL1) >= 0xf0);
    assert.equal(cpu.getSfr(SFR.TCON) & 0x80, 0x80);
  });
  it('externer Interrupt INT0 flankengesteuert', () => {
    let level = 0xff;
    const src = `
      LJMP main
      ORG 03h
      INC R3
      RETI
main: SETB IT0
      SETB EX0
      SETB EA
loop: SJMP loop`;
    const r = assemble(src);
    const cpu = new Cpu8051();
    cpu.loadCode(r.bytes);
    cpu.portInput = (p) => (p === 3 ? level : 0xff);
    for (let i = 0; i < 10; i++) cpu.step();
    level = 0xfb; // INT0 = P3.2 auf Low
    for (let i = 0; i < 10; i++) cpu.step();
    assert.equal(cpu.iram[3], 1);
  });
  it('liefert eine Zugriffsspur für die Animation', () => {
    const r = assemble('MOV 30h,#42h');
    const cpu = new Cpu8051();
    cpu.loadCode(r.bytes);
    const t = cpu.step() as StepTrace;
    assert.ok(t.accesses.some((a) => a.rw === 'w' && a.space === 'iram' && a.addr === 0x30 && a.value === 0x42));
  });
  it('Modell-Rechner: Befehlssatz wie im Original (62 Formen = 146 Opcodes)', () => {
    assert.equal(OPCODES.filter((o) => o.model).length, 146);
    for (const t of ['MOV R5,#const8', 'JB badr,rel', 'DA A', 'MOVX @DPTR,A']) assert.ok(OPCODES.find((o) => o.template.replace(/R\d/, 'R5') === t || o.template === t)?.model, t);
    for (const t of ['LCALL adr16', 'RET', 'SUBB A,#const8', 'PUSH dadr', 'MOV A,@R0', 'SETB badr', 'MUL AB']) assert.equal(OPCODES.find((o) => o.template === t)?.model, false, t);
  });
  it('Modell-Rechner lehnt Befehle außerhalb des Befehlssatzes ab', () => {
    const r = assemble('LCALL 0');
    const cpu = new Cpu8051();
    cpu.modelOnly = true;
    cpu.loadCode(r.bytes);
    assert.ok(isError(cpu.step()));
  });
  it('serielle Ausgabe', () => {
    const out: number[] = [];
    run("MOV SCON,#50h\nMOV SBUF,#'X'\nJNB TI,$\nSJMP $", 2000, (c) => { c.onSerialTx = (b) => out.push(b); });
    assert.deepEqual(out, [0x58]);
  });
});

describe('Assembler', () => {
  it('meldet Fehler mit Zeilennummer', () => {
    const r = assemble('MOV A,#1\nFOO R1\nSJMP nirgends');
    assert.deepEqual(r.errors.map((e) => e.line), [2, 3]);
  });
  it('verbietet Labels mit SFR-/Bit-/Registernamen', () => {
    const r = assemble('p1: NOP\nTR0 EQU 5\nR3: NOP\nok: NOP');
    assert.deepEqual(r.errors.map((e) => e.line), [1, 2, 3]);
  });
  it('prüft relative Sprungweite', () => {
    const r = assemble('SJMP weit\nORG 200h\nweit: NOP');
    assert.match(r.errors[0]!.message, /zu weit/);
  });
  it('Ausdrücke, EQU mit Vorwärtsreferenz, DB-Strings, DW', () => {
    const r = assemble(`X EQU Y+1\nY EQU 10h\nMOV A,#X*2\nMOV DPTR,#tab\ntab: DB 'AB',0,"C"\nDW 1234h`);
    assert.deepEqual(r.errors, []);
    assert.deepEqual([...r.bytes.values()], [0x74, 0x22, 0x90, 0x00, 0x05, 0x41, 0x42, 0x00, 0x43, 0x12, 0x34]);
  });
});

describe('Beispielprogramme', async () => {
  const dir = join(import.meta.dirname, '../src/examples');
  for await (const file of glob('*.asm', { cwd: dir })) {
    it(`${file} assembliert und läuft`, async () => {
      const src = await readFile(join(dir, file), 'utf8');
      const meta = parseMeta(src);
      assert.ok(meta.title, 'Titel fehlt');
      const cpu = run(src, 0);
      cpu.modelOnly = meta.mode === 'model';
      for (let i = 0; i < 200_000; i++) {
        const t = cpu.step();
        if (isError(t)) assert.fail(`Ungültiger Befehl ${t.opcode.toString(16)}h bei ${t.pc.toString(16)}h`);
      }
    });
  }
});

describe('Lauflicht-Verhalten', () => {
  it('rotiert das Bitmuster an P1', async () => {
    const src = await readFile(join(import.meta.dirname, '../src/examples/01-lauflicht.asm'), 'utf8');
    const seen = new Set<number>();
    const cpu = run(src, 0, (c) => { c.onPortWrite = (p, v) => { if (p === 1) seen.add(v); }; });
    while (cpu.cycles < 1_000_000) cpu.step();
    assert.ok([1, 2, 4, 8, 16, 32, 64, 128].every((v) => seen.has(v)));
  });
});
