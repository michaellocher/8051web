/**
 * AutoLade wie im Original („Programm ablegen"): Wird die geöffnete HEX- oder ASM-Datei außerhalb
 * (z. B. vom Assembler einer IDE) neu erzeugt, lädt 8051webXL sie beim Zurückkehren ins Fenster
 * automatisch neu und quittiert mit einem Piep. Nutzt die File System Access API (Chrome/Edge).
 */

interface PickerWindow {
  showOpenFilePicker?(o: unknown): Promise<FileSystemFileHandle[]>;
}

let handle: FileSystemFileHandle | undefined;
let lastModified = 0;
let enabled = false;

export const pickerSupported = () => typeof (window as PickerWindow).showOpenFilePicker === 'function';

/** Datei über den modernen Dialog wählen (merkt sich die Datei für AutoLade) */
export async function pickFile(): Promise<File | undefined> {
  const picker = (window as PickerWindow).showOpenFilePicker;
  if (!picker) return undefined;
  const [h] = await picker.call(window, {
    types: [{ description: '8051-Programme', accept: { 'text/plain': ['.hex', '.ihx', '.hexpw', '.asm', '.a51', '.s', '.txt'] } }],
    excludeAcceptAllOption: false,
  });
  if (!h) return undefined;
  handle = h;
  const f = await h.getFile();
  lastModified = f.lastModified;
  return f;
}

export function forgetFile() { handle = undefined; }
export const autoloadEnabled = () => enabled;
export const hasWatchedFile = () => handle !== undefined;

export function setAutoload(on: boolean) { enabled = on; }

/** Prüft beim Zurückkehren, ob sich die Datei geändert hat. Liefert die neue Datei oder undefined. */
export async function checkForUpdate(): Promise<File | undefined> {
  if (!enabled || !handle) return undefined;
  const f = await handle.getFile();
  if (f.lastModified === lastModified) return undefined;
  lastModified = f.lastModified;
  return f;
}

export function beep() {
  try {
    const ctx = new AudioContext();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.frequency.value = 880;
    gain.gain.setValueAtTime(0.08, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + 0.15);
    osc.connect(gain).connect(ctx.destination);
    osc.start();
    osc.stop(ctx.currentTime + 0.16);
    osc.onended = () => void ctx.close();
  } catch {
    /* ohne Ton */
  }
}
