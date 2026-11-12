import type { Cpu8051 } from '../core/cpu.ts';
import type { SimMode } from '../core/meta.ts';
import { hex2 } from '../core/sfr.ts';
import type { Device, DeviceDef } from '../io/kit.ts';
import { DEVICE_BY_ID } from '../io/registry.ts';
import { h } from './dom.ts';

/** Port-Spalten je Oberfläche: [oben, unten]; null = Infofeld (ext. Bus) */
export const PORT_LAYOUT: Record<SimMode, readonly (readonly [number | null, number])[]> = {
  int: [[0, 1], [2, 4]],
  ext: [[null, 1], [4, 5]],
  model: [[0, 1]],
};

export type DeviceConfig = Record<SimMode, Record<string, string>>;

interface Attached {
  def: DeviceDef;
  device: Device;
  ports: number[];
}

interface SlotView {
  port: number;
  reg: HTMLElement;
  pin: HTMLElement;
  pins: HTMLElement[];
  dev: HTMLElement;
}

/**
 * Verwaltet die angeschlossenen Geräte und den Port-Bereich der Oberfläche.
 * Liefert der CPU die externen Pegel und versorgt die Geräte mit den Pinzuständen.
 */
export class PortManager {
  readonly #cpu: Cpu8051;
  #mode: SimMode = 'int';
  #attached: Attached[] = [];
  #byPort = new Map<number, { a: Attached; idx: number }[]>();
  #slots: SlotView[] = [];
  #running = false;
  config: DeviceConfig = { int: {}, ext: {}, model: {} };
  /** Externe Pegel an P3 (T0/T1/INT0/INT1-Taster) */
  p3ext = 0xff;
  onChange: () => void = () => {};
  onPick: (port: number, pair: readonly [number | null, number]) => void = () => {};

  constructor(cpu: Cpu8051) {
    this.#cpu = cpu;
    cpu.portInput = (p) => {
      let v = p === 3 ? this.p3ext : 0xff;
      if (p === 3) for (const a of this.#attached) if (a.device.driveP3) v &= a.device.driveP3();
      const list = this.#byPort.get(p);
      if (list) {
        const latch = cpu.latch(p);
        for (const { a, idx } of list) v &= a.device.drive(idx, latch);
      }
      return v;
    };
    cpu.onPortWrite = (p, v) => {
      const list = this.#byPort.get(p);
      if (list) for (const { a, idx } of list) a.device.write?.(idx, v);
    };
  }

  get mode() { return this.#mode; }

  /** Gerätedefinition, die an diesem Port hängt */
  deviceAt(port: number): DeviceDef | undefined {
    return this.#byPort.get(port)?.[0]?.a.def;
  }

  setMode(mode: SimMode) {
    this.#mode = mode;
    this.#rebuild();
  }

  assign(port: number, deviceId: string | undefined) {
    const cfg = this.config[this.#mode];
    const col = PORT_LAYOUT[this.#mode].find((c) => c.includes(port));
    const def = deviceId ? DEVICE_BY_ID.get(deviceId) : undefined;
    // 2-Port-Geräte der Spalte entfernen, wenn einer ihrer Ports neu belegt wird
    if (col) for (const p of col) if (p !== null && DEVICE_BY_ID.get(cfg[`P${p}`] ?? '')?.ports === 2) delete cfg[`P${p}`];
    if (def?.ports === 2 && col) {
      for (const p of col) if (p !== null) delete cfg[`P${p}`];
      const first = col.find((p): p is number => p !== null)!;
      cfg[`P${first}`] = def.id;
    } else if (def) cfg[`P${port}`] = def.id;
    else delete cfg[`P${port}`];
    this.#rebuild();
    this.onChange();
  }

  clear(mode: SimMode = this.#mode) {
    this.config[mode] = {};
    if (mode === this.#mode) this.#rebuild();
  }

  setRunning(r: boolean) {
    this.#running = r;
    for (const a of this.#attached) a.device.setRunning?.(r);
  }

  /** Nach jedem Befehl aufrufen */
  sample(cycles: number) {
    for (const a of this.#attached) {
      const pins = a.ports.map((p) => this.#cpu.pin(p));
      if (a.def.usesP3) pins.push(this.#cpu.pin(3));
      a.device.sample(pins, cycles);
    }
  }

  #rebuild() {
    for (const a of this.#attached) a.device.destroy?.();
    this.#attached = [];
    this.#byPort.clear();
    const cfg = this.config[this.#mode];
    for (const col of PORT_LAYOUT[this.#mode]) {
      for (const p of col) {
        if (p === null) continue;
        const def = DEVICE_BY_ID.get(cfg[`P${p}`] ?? '');
        if (!def) continue;
        const ports = def.ports === 2 ? col.filter((x): x is number => x !== null) : [p];
        if (def.ports === 2 && ports.length < 2) continue;
        const device = def.create(() => this.onChange());
        const a: Attached = { def, device, ports };
        this.#attached.push(a);
        ports.forEach((pp, idx) => {
          const list = this.#byPort.get(pp) ?? [];
          list.push({ a, idx });
          this.#byPort.set(pp, list);
        });
        device.setRunning?.(this.#running);
        ports.forEach((pp, idx) => device.write?.(idx, this.#cpu.latch(pp)));
      }
    }
    this.sample(0);
  }

  /** Baut den Port-Bereich in `container` auf */
  mount(container: HTMLElement) {
    container.replaceChildren();
    this.#slots = [];
    for (const col of PORT_LAYOUT[this.#mode]) {
      const colEl = h('div', { class: 'port-col' });
      container.append(colEl);
      const twoPort = this.#attached.find((a) => a.def.ports === 2 && a.ports.every((p) => col.includes(p)));
      col.forEach((port, slotIdx) => {
        const rowStart = slotIdx * 9 + 1;
        if (port === null) {
          colEl.append(h('div', { class: 'port-info', style: `grid-row: ${rowStart} / span 8` },
            h('div', { text: 'P0 = gemultiplexter Adress- und Daten-Port' }), h('hr'), h('div', { text: 'P2 = High-Byte der Adresse' })));
          return;
        }
        const ioBtn = h('button', { class: 'io-btn', title: `Gerät an P${port} anschließen`, text: 'I/O' });
        ioBtn.addEventListener('click', () => this.onPick(port, col));
        const reg = h('output', { class: 'reg', title: `Latch P${port}`, 'data-sfr': hex2([0x80, 0x90, 0xa0, 0xb0, 0xe8, 0xf8][port]!), 'data-edit': '' });
        const pin = h('output', { class: 'reg', title: `Pegel an P${port}` });
        colEl.append(h('div', { class: 'port-ctl', style: `grid-row: ${rowStart} / span 8` },
          ioBtn, h('span', { class: 'port-name', text: `P${port}` }),
          h('span', { class: 'lbl', text: 'REG' }), reg, h('span', { class: 'lbl', text: 'PIN' }), pin));
        const pins = Array.from({ length: 8 }, (_, i) => {
          const e = h('div', { class: 'pin', style: `grid-row: ${rowStart + i}` }, `P${port}.${i}`, h('i'));
          colEl.append(e);
          return e;
        });
        let dev: HTMLElement;
        if (twoPort) {
          dev = colEl.querySelector<HTMLElement>('.port-dev') ?? h('div', { class: 'port-dev', style: 'grid-row: 1 / span 17' }, twoPort.device.svg);
          if (!dev.isConnected) colEl.append(dev);
        } else {
          const a = this.#byPort.get(port)?.[0]?.a;
          dev = a
            ? h('div', { class: 'port-dev', style: `grid-row: ${rowStart} / span 8`, title: a.def.desc }, a.device.svg)
            : h('div', { class: 'port-dev empty', style: `grid-row: ${rowStart} / span 8`, text: '+ Gerät anschließen' });
          if (!a) dev.addEventListener('click', () => this.onPick(port, col));
          colEl.append(dev);
        }
        this.#slots.push({ port, reg, pin, pins, dev });
      });
    }
  }

  render() {
    for (const s of this.#slots) {
      const latch = this.#cpu.latch(s.port);
      const pin = this.#cpu.pin(s.port);
      s.pin.textContent = hex2(pin);
      s.pins.forEach((e, i) => {
        const on = ((pin >> i) & 1) === 1;
        e.classList.toggle('on', on);
        // Pin wird von außen auf Low gezogen, obwohl das Latch 1 ist
        e.classList.toggle('ext', !on && ((latch >> i) & 1) === 1);
      });
    }
    for (const a of this.#attached) a.device.render();
  }
}
