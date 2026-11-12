/** Speiseaufzug (2-Port-Modell, Ansicht). */
import { board, el, pushButton, rowY, setLit, wire, type DeviceDef } from '../kit.ts';
import { label, selectButton } from './b2util.ts';
import { Speiseaufzug } from './speiseaufzug.logic.ts';

const speiseaufzug: DeviceDef = {
  id: 'speiseaufzug', name: 'Speiseaufzug', group: '2-Port-Modelle', ports: 2, width: 250, usesP3: true,
  desc: 'Speiseaufzug mit Tür oben und Tür unten. Eingänge des Modells (Ausgänge des Programms, PORT-unten): D0 = H Aufzugmotor abwärts, D1 = I Aufzugmotor aufwärts, '
    + 'D2 = J Tür-oben schließen, D3 = K Tür-oben öffnen, D4 = L Tür-unten schließen, D5 = M Tür-unten öffnen (H=I bzw. J=K bzw. L=M: Motor steht). '
    + 'Ausgänge des Modells (0 = aktiv): PORT-oben D0 = Taste aufwärts oben, D1 = Taste abwärts oben, D2 = A Tor-oben-auf, D3 = B Tor-oben-zu, D4 = C Tor-unten-auf, '
    + 'D5 = D Tor-unten-zu, D6 = E Aufzug-oben, D7 = F Aufzug-unten; PORT-unten D6 = Taste aufwärts unten, D7 = Taste abwärts unten. '
    + 'Die Lichtschranken an den Türen (INT0 oben = G, INT1 unten = N) werden per Taste ein- und ausgeschaltet und lösen INT0 bzw. INT1 aus (P3.2 / P3.3 = 0).',
  create(onInput) {
    const t = new Speiseaufzug();
    const svg = board(250, 2);
    // Anschlüsse
    const letters: [number, string, boolean][] = [
      [0, 'D0', true], [1, 'D1', true],
      [2, 'A', true], [3, 'B', true], [4, 'C', true], [5, 'D', true], [6, 'E', true], [7, 'F', true],
      [9, 'H', false], [10, 'I', false], [11, 'J', false], [12, 'K', false], [13, 'L', false], [14, 'M', false],
      [15, 'D6', true], [16, 'D7', true],
    ];
    for (const [row, name, inp] of letters) { wire(svg, row, 36, inp); label(svg, 9, rowY(row) - 3, name, name.length > 1 && name[0] === 'D' ? 'dev-tiny' : 'sa-let'); }

    // Tasten oben / unten
    const key = (row: number, sym: string, set: (d: boolean) => void) => pushButton(svg, 44, rowY(row) - 8, 40, 16, sym, (d) => { set(d); onInput(); });
    key(0, '▲', (d) => { t.keyTopUp = d; }); key(1, '▼', (d) => { t.keyTopDown = d; });
    key(15, '▲', (d) => { t.keyBottomUp = d; }); key(16, '▼', (d) => { t.keyBottomDown = d; });
    const int0 = selectButton(svg, 170, 8, 70, 26, 'INT0', () => { t.barrierTop = !t.barrierTop; onInput(); });
    const int1 = selectButton(svg, 170, 306, 70, 26, 'INT1', () => { t.barrierBottom = !t.barrierBottom; onInput(); });
    label(svg, 94, 24, 'oben', 'dev-tiny'); label(svg, 94, 322, 'unten', 'dev-tiny');

    // Szene
    el('rect', { x: 42, y: 44, width: 204, height: 126, rx: 3, class: 'sa-floor' }, svg);
    el('rect', { x: 42, y: 174, width: 204, height: 126, rx: 3, class: 'sa-floor' }, svg);
    const shaftX = 80, shaftW = 62;
    el('rect', { x: shaftX, y: 54, width: shaftW, height: 236, class: 'sa-shaft' }, svg);
    const topY = 62, botY = 212, doorH = 46;
    const cab = el('g', {}, svg);
    el('rect', { x: shaftX + 3, y: 0, width: shaftW - 6, height: doorH, class: 'sa-cab' }, cab);
    el('rect', { x: shaftX + 12, y: 22, width: 26, height: 20, rx: 2, class: 'sa-dish' }, cab);
    el('rect', { x: shaftX + 18, y: 6, width: 14, height: 14, rx: 7, class: 'sa-food' }, cab);
    const door = (y: number) => {
      el('rect', { x: 150, y, width: 78, height: doorH, class: 'sa-open' }, svg);
      const panel = el('rect', { x: 150, y, width: 78, height: doorH, class: 'sa-door' }, svg);
      const barrier = el('line', { x1: 150, y1: y + doorH / 2, x2: 228, y2: y + doorH / 2, class: 'sa-barrier' }, svg);
      return { panel, barrier };
    };
    const dTop = door(topY), dBot = door(botY);
    // Fähnchen für Sensoren / Lichtschranken
    const flag = (x: number, y: number, name: string, dir: 'l' | 'r') => {
      const d = dir === 'r' ? `M${x} ${y} h22 l6 7 l-6 7 h-22 z` : `M${x + 28} ${y} h-22 l-6 7 l6 7 h22 z`;
      const f = el('path', { d, class: 'sa-flag' }, svg);
      label(svg, x + 11 + (dir === 'l' ? 0 : 0), y + 11, name, 'sa-flag-txt', 'middle');
      return f;
    };
    const fE = flag(46, 66, 'E', 'r'), fG = flag(46, 108, 'G', 'r');
    const fF = flag(46, 216, 'F', 'r'), fN = flag(46, 258, 'N', 'r');
    const fB = flag(150, 112, 'B', 'r'), fA = flag(198, 112, 'A', 'r');
    const fD = flag(150, 262, 'D', 'r'), fC = flag(198, 262, 'C', 'r');
    // Motoren
    const motor = (x: number, y: number, a: string, b: string, sa: string, sb: string) => {
      const g = el('g', { transform: `translate(${x} ${y})` }, svg);
      el('circle', { cx: 0, cy: 0, r: 8, class: 'sa-motor' }, g);
      label(g, 0, 3.5, 'M', 'sa-motor-txt', 'middle');
      const la = label(g, 13, -2, `${a}${sa}`, 'sa-mot', 'start');
      const lb = label(g, 13, 9, `${b}${sb}`, 'sa-mot', 'start');
      return [la, lb] as const;
    };
    const mEl = motor(112, 54, 'H', 'I', '▼', '▲');
    const mTop = motor(186, 150, 'J', 'K', ' zu', ' auf');
    const mBot = motor(186, 284, 'L', 'M', ' zu', ' auf');
    return {
      svg,
      drive: (i) => t.drive(i),
      driveP3: () => t.driveP3(),
      sample([, pb = 0xff], c) { t.setMotors(pb); t.step(c * 1e-6); },
      render() {
        cab.setAttribute('transform', `translate(0 ${botY - (botY - topY) * t.pos})`);
        const setDoor = (d: { panel: SVGElement }, open: number) => {
          const w = 78 * (1 - open);
          d.panel.setAttribute('x', String(228 - w)); d.panel.setAttribute('width', String(Math.max(0, w)));
        };
        setDoor(dTop, t.doorTop); setDoor(dBot, t.doorBottom);
        const on = (e: SVGElement, v: boolean) => setLit(e, v ? 1 : 0);
        on(fA, t.doorTopOpenSensor); on(fB, t.doorTopClosedSensor); on(fC, t.doorBottomOpenSensor); on(fD, t.doorBottomClosedSensor);
        on(fE, t.elevatorTop); on(fF, t.elevatorBottom); on(fG, t.barrierTop); on(fN, t.barrierBottom);
        dTop.barrier.classList.toggle('hit', t.barrierTop); dBot.barrier.classList.toggle('hit', t.barrierBottom);
        int0.setActive(t.barrierTop); int1.setActive(t.barrierBottom);
        const lamp = (e: SVGElement, v: boolean) => e.classList.toggle('on', v);
        lamp(mEl[0], t.h); lamp(mEl[1], t.i); lamp(mTop[0], t.j); lamp(mTop[1], t.k); lamp(mBot[0], t.l); lamp(mBot[1], t.m);
      },
    };
  },
};

export const LIFT_DEVICES: readonly DeviceDef[] = [speiseaufzug];
