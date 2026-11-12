/**
 * Passwortgeschützte HEX-Dateien (.hexpw) – entspricht dem PW-Schutz des Originals.
 *
 * Der Inhalt (Intel-HEX-Text) wird mit einem zufälligen Inhaltsschlüssel (AES-256-GCM) verschlüsselt.
 * Dieser Schlüssel liegt zweimal in der Datei:
 *  - mit dem Passwort verpackt (PBKDF2-SHA-256 → AES-GCM): Einsicht und Bearbeitung nur mit Passwort
 *  - optional offen ("runKey"): Das Programm darf ohne Passwort ausgeführt werden, die Oberfläche
 *    blendet Code und Programmspeicher aus. Das ist ein Schutz gegen einfaches Abschauen,
 *    keine Kopiersperre.
 */

export interface PwFile {
  readonly format: '8051webXL-pw';
  readonly v: 1;
  readonly name: string;
  readonly iter: number;
  readonly salt: string;
  readonly wrapIv: string;
  readonly wrapped: string;
  readonly dataIv: string;
  readonly data: string;
  readonly runKey: string | null;
  /** Quelltext (ASM/C), nur mit dem Passwort entschlüsselbar – nie über den runKey */
  readonly srcIv?: string;
  readonly src?: string;
}

export interface SourceAttachment {
  readonly text: string;
  readonly name: string;
  readonly kind: 'asm' | 'c';
}

const enc = new TextEncoder();
const dec = new TextDecoder();
const ITERATIONS = 250_000;
const rand = (n: number) => crypto.getRandomValues(new Uint8Array(n));
const b64 = (u: Uint8Array) => u.toBase64();
const unb64 = (s: string) => Uint8Array.fromBase64(s) as Uint8Array<ArrayBuffer>;

async function passwordKey(password: string, salt: Uint8Array<ArrayBuffer>, iter: number): Promise<CryptoKey> {
  const base = await crypto.subtle.importKey('raw', enc.encode(password), 'PBKDF2', false, ['deriveKey']);
  return crypto.subtle.deriveKey(
    { name: 'PBKDF2', hash: 'SHA-256', salt, iterations: iter },
    base, { name: 'AES-GCM', length: 256 }, false, ['encrypt', 'decrypt'],
  );
}

const aesKey = (raw: Uint8Array<ArrayBuffer>) => crypto.subtle.importKey('raw', raw, 'AES-GCM', false, ['encrypt', 'decrypt']);

export async function encryptHex(hexText: string, password: string, runOnly: boolean, name: string, source?: SourceAttachment): Promise<string> {
  const contentKey = rand(32);
  const salt = rand(16), wrapIv = rand(12), dataIv = rand(12);
  const pk = await passwordKey(password, salt, ITERATIONS);
  const wrapped = new Uint8Array(await crypto.subtle.encrypt({ name: 'AES-GCM', iv: wrapIv }, pk, contentKey));
  const data = new Uint8Array(await crypto.subtle.encrypt({ name: 'AES-GCM', iv: dataIv }, await aesKey(contentKey), enc.encode(hexText)));
  let srcPart: { srcIv: string; src: string } | undefined;
  if (source) {
    const srcIv = rand(12);
    const src = new Uint8Array(await crypto.subtle.encrypt({ name: 'AES-GCM', iv: srcIv }, pk, enc.encode(JSON.stringify(source))));
    srcPart = { srcIv: b64(srcIv), src: b64(src) };
  }
  const file: PwFile = {
    format: '8051webXL-pw', v: 1, name, iter: ITERATIONS,
    salt: b64(salt), wrapIv: b64(wrapIv), wrapped: b64(wrapped), dataIv: b64(dataIv), data: b64(data),
    runKey: runOnly ? b64(contentKey) : null,
    ...srcPart,
  };
  return `${JSON.stringify(file, null, 1)}\n`;
}

export function parsePwFile(text: string): PwFile | undefined {
  try {
    const f = JSON.parse(text) as Partial<PwFile>;
    return f.format === '8051webXL-pw' && f.v === 1 ? (f as PwFile) : undefined;
  } catch {
    return undefined;
  }
}

export class WrongPassword extends Error {
  constructor() { super('Falsches Passwort'); }
}

/**
 * Öffnet eine .hexpw-Datei. Mit Passwort → entschlüsselt (unlocked = true).
 * Ohne Passwort nur, wenn die Datei das Ausführen erlaubt (unlocked = false).
 */
export async function openPwFile(f: PwFile, password?: string): Promise<{ hex: string; unlocked: boolean; runOnly: boolean; source?: SourceAttachment }> {
  let contentKey: Uint8Array<ArrayBuffer>;
  let source: SourceAttachment | undefined;
  if (password !== undefined) {
    const pk = await passwordKey(password, unb64(f.salt), f.iter);
    try {
      contentKey = new Uint8Array(await crypto.subtle.decrypt({ name: 'AES-GCM', iv: unb64(f.wrapIv) }, pk, unb64(f.wrapped)));
    } catch {
      throw new WrongPassword();
    }
    if (f.src && f.srcIv) {
      const plainSrc = await crypto.subtle.decrypt({ name: 'AES-GCM', iv: unb64(f.srcIv) }, pk, unb64(f.src));
      source = JSON.parse(dec.decode(plainSrc)) as SourceAttachment;
    }
  } else if (f.runKey) {
    contentKey = unb64(f.runKey);
  } else {
    throw new WrongPassword();
  }
  const plain = await crypto.subtle.decrypt({ name: 'AES-GCM', iv: unb64(f.dataIv) }, await aesKey(contentKey), unb64(f.data));
  const r = { hex: dec.decode(plain), unlocked: password !== undefined, runOnly: f.runKey !== null };
  return source ? { ...r, source } : r;
}

/** Passwort ohne Sonderzeichen und ohne verwechselbare Zeichen (0/O, 1/l/I), wie simpwortXL. */
export function generatePassword(length = 10): string {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnpqrstuvwxyz23456789';
  // Zurückweisungsverfahren: keine Verzerrung durch Modulo
  const limit = 256 - (256 % chars.length);
  let out = '';
  while (out.length < length) {
    for (const b of crypto.getRandomValues(new Uint8Array(length * 2))) {
      if (b < limit && out.length < length) out += chars[b % chars.length];
    }
  }
  return out;
}
