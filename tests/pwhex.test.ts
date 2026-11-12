import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { encryptHex, generatePassword, openPwFile, parsePwFile, WrongPassword } from '../src/core/pwhex.ts';

const HEX = ':03000000020030CB\n:00000001FF\n';

describe('Passwortgeschützte HEX-Dateien', () => {
  it('entschlüsselt mit dem richtigen Passwort', async () => {
    const f = parsePwFile(await encryptHex(HEX, 'geheim', false, 'test.hex'))!;
    const r = await openPwFile(f, 'geheim');
    assert.equal(r.hex, HEX);
    assert.equal(r.unlocked, true);
  });
  it('lehnt ein falsches Passwort ab', async () => {
    const f = parsePwFile(await encryptHex(HEX, 'geheim', true, 'test.hex'))!;
    await assert.rejects(openPwFile(f, 'falsch'), WrongPassword);
  });
  it('erlaubt Ausführen ohne Passwort nur mit runKey', async () => {
    const run = parsePwFile(await encryptHex(HEX, 'geheim', true, 'a.hex'))!;
    assert.deepEqual(await openPwFile(run), { hex: HEX, unlocked: false, runOnly: true });
    const locked = parsePwFile(await encryptHex(HEX, 'geheim', false, 'b.hex'))!;
    await assert.rejects(openPwFile(locked), WrongPassword);
  });
  it('erzeugt Passwörter ohne Sonderzeichen und verwechselbare Zeichen', () => {
    const pws = Array.from({ length: 200 }, () => generatePassword());
    assert.ok(pws.every((p) => /^[A-HJ-NP-Za-km-z2-9]{10}$/.test(p)));
    assert.equal(new Set(pws).size, 200);
  });
  it('Quelltext nur mit Passwort, nicht über den runKey', async () => {
    const src = { text: 'MOV A,#1\nEND', name: 'loesung.a51', kind: 'asm' as const };
    const f = parsePwFile(await encryptHex(HEX, 'lehrer', true, 'l.hex', src))!;
    const run = await openPwFile(f);
    assert.equal(run.source, undefined);
    assert.ok(!JSON.stringify(f).includes('MOV A'));
    assert.deepEqual((await openPwFile(f, 'lehrer')).source, src);
  });
  it('erkennt Nicht-PW-Dateien', () => {
    assert.equal(parsePwFile(HEX), undefined);
  });
});
