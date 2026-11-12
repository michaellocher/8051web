/** Liest die Kopfzeilen eines Beispielprogramms ("; @title …", "; @io P1=leds", …). */

export type SimMode = 'int' | 'ext' | 'model';

export interface ProgramMeta {
  title?: string;
  desc?: string;
  /** Gruppe im Beispielmenü */
  group?: string;
  mode?: SimMode;
  io: { port: number; device: string }[];
  terminal: boolean;
}

export function parseMeta(source: string): ProgramMeta {
  const meta: ProgramMeta = { io: [], terminal: false };
  for (const [, key, value = ''] of source.matchAll(/^\s*;\s*@(\w+)[ \t]*(.*)$/gm)) {
    switch (key) {
      case 'title': meta.title = value.trim(); break;
      case 'desc': meta.desc = value.trim(); break;
      case 'group': meta.group = value.trim(); break;
      case 'mode':
        if (value.trim() === 'int' || value.trim() === 'ext' || value.trim() === 'model') meta.mode = value.trim() as SimMode;
        break;
      case 'io': {
        const m = /^P(\d)\s*=\s*([\w-]+)/i.exec(value.trim());
        if (m) meta.io.push({ port: Number(m[1]), device: m[2]! });
        break;
      }
      case 'terminal': meta.terminal = true; break;
    }
  }
  return meta;
}
