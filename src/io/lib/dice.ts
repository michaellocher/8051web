/** Würfel-1, Würfel-2 und Würfel-3 (Handbuch „Sonstige Modelle“). */
import { board, el, led, pushButton, rowY, type DeviceDef } from '../kit.ts';
import { LampBank, label, pinRows, slideSwitch, type Pin } from './b1-view.ts';
import { DICE3_LEFT, DICE3_RIGHT, DICE1_CELL, dice1Cells, dice2Cells, dice3Cells } from './dice.logic.ts';
import { highIf } from './b1-common.ts';

const dlabels = (n: number, input = new Set<number>()): Pin[] =>
  Array.from({ length: n }, (_, i): Pin => [i, `D${i}`, input.has(i)]);

/** Würfelkörper mit 3×3 Leuchtpunkten; `tags[cell]` beschriftet die Punkte (Datenbit), `null` = Zelle nicht vorhanden. */
function die(svg: SVGSVGElement, x: number, y: number, size: number, tags?: readonly (number | null)[], skip: readonly number[] = [1, 7]) {
  el('rect', { x, y, width: size, height: size, rx: size * 0.16, class: 'dice-body' }, svg);
  const r = size * 0.1;
  const lamps: (SVGElement | undefined)[] = [];
  for (let c = 0; c < 9; c++) {
    const cx = x + size * (0.2 + 0.3 * (c % 3)), cy = y + size * (0.2 + 0.3 * Math.floor(c / 3));
    const t = tags?.[c];
    if (t === null || (!tags && skip.includes(c))) { lamps.push(undefined); continue; }
    lamps.push(led(svg, cx, cy, r, 'red'));
    if (t !== undefined) label(svg, cx, cy + 3, String(t), 'dm-pip-tag', 'middle');
  }
  return lamps;
}

const dice: DeviceDef = {
  id: 'dice', name: 'Würfel-1', group: 'Würfel', ports: 1, width: 170,
  desc: 'Würfelmuster-Anzeige und Schiebeschalter. Der Wert der binären Eingänge wird als Leuchtpunkt angezeigt: jeder Pin D0–D6 steuert einen Punkt '
    + '(D0 oben links, D1 Mitte links, D2 unten links, D3 Mitte, D4 oben rechts, D5 Mitte rechts, D6 unten rechts; 1 = leuchtet). '
    + 'D7 = Schiebeschalter (Eingang, rechts/rot = 1, links = 0), der beliebig verwendet werden kann.',
  create(onInput) {
    const svg = board(170, 1);
    pinRows(svg, dlabels(8, new Set([7])), 40);
    // Punktnummern = Datenbits (Zelle → Bit)
    const tags: (number | null)[] = Array.from({ length: 9 }, () => null);
    DICE1_CELL.forEach((cell, b) => { tags[cell] = b; });
    const lamps = die(svg, 56, 6, 108, tags);
    let on = false;
    const upd = slideSwitch(svg, 78, rowY(7) - 9, () => on, (v) => { on = v; onInput(); }, 64, 18);
    const present = lamps.map((l, c) => (l ? c : -1)).filter((c) => c >= 0);
    const bank = new LampBank(lamps.filter((l): l is SVGElement => l !== undefined), (i, [p = 0]) => {
      return dice1Cells(p)[present[i]!]!;
    });
    return { svg, drive: () => highIf([7, on]), sample: (p, c) => bank.sample(p, c), render() { bank.render(); upd(); } };
  },
};

const dice2: DeviceDef = {
  id: 'dice2', name: 'Würfel-2', group: 'Würfel', ports: 1, width: 200,
  desc: 'Würfelmuster-Anzeige mit Decoder, Start- und Reset-Taste und drei LEDs. Der Wert der Eingänge D0–D2 wird als Würfelmuster angezeigt (BCD; bei 0 und 7 erscheint das Symbol leer). '
    + 'Der Zustand der Tasten wird über D3 (Start) und D4 (Reset) zum Port übertragen (Eingänge, 1 = gedrückt). '
    + 'Die LEDs an D5–D7 (Ausgänge, 1 = an) können z. B. zur Ereigniszählung verwendet werden.',
  create(onInput) {
    const svg = board(200, 1);
    pinRows(svg, dlabels(8, new Set([3, 4])), 40);
    // Decoder
    el('rect', { x: 46, y: 6, width: 40, height: 50, class: 'dev-chip' }, svg);
    el('line', { x1: 86, y1: 6, x2: 46, y2: 56, class: 'dev-chip-line' }, svg);
    label(svg, 50, 19, 'BCD', 'dm-chip-txt');
    label(svg, 82, 51, 'Würfel', 'dm-chip-txt', 'end');
    const lamps = die(svg, 94, 4, 100);
    let start = false, reset = false;
    pushButton(svg, 46, rowY(3) - 8, 46, 16, 'Start', (d) => { start = d; onInput(); });
    pushButton(svg, 46, rowY(4) - 8, 46, 16, 'Reset', (d) => { reset = d; onInput(); });
    const leds = [5, 6, 7].map((b) => {
      const l = led(svg, 110 + (b - 5) * 36, 134, 8, 'red');
      label(svg, 110 + (b - 5) * 36, 118, `D${b}`, 'dev-tiny', 'middle');
      return l;
    });
    const present = lamps.map((l, c) => (l ? c : -1)).filter((c) => c >= 0);
    const all = [...present.map((c) => lamps[c]!), ...leds];
    const bank = new LampBank(all, (i, [p = 0]) => (i < present.length ? dice2Cells(p)[present[i]!]! : ((p >> (i - present.length + 5)) & 1) === 1));
    return {
      svg,
      drive: () => highIf([3, start], [4, reset]),
      sample: (p, c) => bank.sample(p, c),
      render: () => bank.render(),
    };
  },
};

const dice3: DeviceDef = {
  id: 'dice3', name: 'Würfel-3', group: 'Würfel', ports: 1, width: 230,
  desc: 'Display zur Anzeige von Würfelmustern mit zwei Würfeln. Die Signale der Ausgänge D0–D7 werden direkt als Leuchtpunkte angezeigt (1 = leuchtet); '
    + 'gegenüberliegende Augen hängen am selben Bit. Linker Würfel: D7 = oben links + unten rechts, D5 = oben rechts + unten links, D6 = Mitte links + Mitte rechts, D4 = Mitte. '
    + 'Rechter Würfel: D3, D1, D2, D0 entsprechend.',
  create() {
    const svg = board(230, 1);
    pinRows(svg, dlabels(8), 40);
    const tagsOf = (m: readonly number[]) => m.map((b) => (b < 0 ? null : b));
    const left = die(svg, 48, 28, 84, tagsOf(DICE3_LEFT));
    const right = die(svg, 142, 28, 84, tagsOf(DICE3_RIGHT));
    const all: { el: SVGElement; die: 0 | 1; cell: number }[] = [];
    left.forEach((l, c) => { if (l) all.push({ el: l, die: 0, cell: c }); });
    right.forEach((l, c) => { if (l) all.push({ el: l, die: 1, cell: c }); });
    const bank = new LampBank(all.map((a) => a.el), (i, [p = 0]) => {
      const a = all[i]!;
      return dice3Cells(p, a.die === 0 ? DICE3_LEFT : DICE3_RIGHT)[a.cell]!;
    });
    return { svg, drive: () => 0xff, sample: (p, c) => bank.sample(p, c), render: () => bank.render() };
  },
};

export const DICE_DEVICES: readonly DeviceDef[] = [dice, dice2, dice3];
