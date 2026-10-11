/**
 * SerialLink — Web Serial transport for EasyInput V2.0.
 *
 * Mirrors the connection model used by easyinput-beatbox / drumRhythmGame:
 *  - filter by Espressif VID (0x303A)
 *  - 115200 baud, 8-N-1
 *  - one JSON object per line, '\n' terminated
 *  - auto-reconnect to already-granted ports
 *  - a "ping" is sent on open so the device re-emits hello+state
 *
 * This class only deals with bytes <-> lines. Parsed messages are delivered
 * to the consumer via `onMessage`. It does not know about app modes.
 */
import { ESPRESSIF_VID, BAUD_RATE, parseHostLine } from "./protocol.js";

export class SerialLink {
  constructor() {
    this.port = null;
    this.reader = null;
    this.writer = null;
    this.readLoopActive = false;
    this.rxText = "";
    this.connected = false;
    this.userDisconnected = false;
    this.reconnectTimer = null;
    this.messageListeners = new Set();
    this.connectionListeners = new Set();
  }

  get supported() {
    return typeof navigator !== "undefined" && "serial" in navigator;
  }

  onMessage(cb) {
    this.messageListeners.add(cb);
    return () => this.messageListeners.delete(cb);
  }

  onConnectionChange(cb) {
    this.connectionListeners.add(cb);
    return () => this.connectionListeners.delete(cb);
  }

  _emitConnection() {
    for (const cb of this.connectionListeners) cb(this.connected);
  }

  _emitMessage(msg) {
    for (const cb of this.messageListeners) cb(msg);
  }

  async connect() {
    if (!this.supported) throw new Error("Web Serial not supported. Use Chrome or Edge.");
    this.scheduleAutoReconnect();
    await this.tryExistingPorts();
  }

  async requestPort() {
    if (!this.supported) throw new Error("Web Serial not supported. Use Chrome or Edge.");
    this.userDisconnected = false;
    const port = await navigator.serial.requestPort({
      filters: [{ usbVendorId: ESPRESSIF_VID }],
    });
    await this.openPort(port);
  }

  async disconnect() {
    this.userDisconnected = true;
    await this.closePort();
    this.connected = false;
    this._emitConnection();
  }

  scheduleAutoReconnect() {
    if (this.reconnectTimer != null) return;
    this.reconnectTimer = window.setInterval(() => {
      if (!this.connected && !this.userDisconnected) void this.tryExistingPorts();
    }, 1500);
  }

  async tryExistingPorts() {
    if (this.userDisconnected || this.connected || this.readLoopActive) return;
    const ports = await navigator.serial.getPorts();
    for (const port of ports) {
      const info = port.getInfo();
      if (info.usbVendorId != null && info.usbVendorId !== ESPRESSIF_VID) continue;
      try {
        await this.openPort(port);
        return;
      } catch {
        /* try next */
      }
    }
  }

  async openPort(port) {
    if (this.port === port && this.connected) return;
    await this.closePort();
    this.port = port;
    await port.open({ baudRate: BAUD_RATE });
    this.writer = port.writable?.getWriter() ?? null;
    this.reader = port.readable?.getReader() ?? null;
    this.readLoopActive = true;
    this.rxText = "";
    this.connected = true;
    this._emitConnection();
    void this.writeLine('{"t":"ping"}');
    // 连接即自动把板子切到 english 模式（免手动长按 S1+S8）；依赖新固件支持的 appmode 命令
    void this.writeLine('{"t":"appmode","v":3}');
    void this.readLoop();
  }

  async closePort() {
    const reader = this.reader;
    const writer = this.writer;
    const port = this.port;
    this.reader = null;
    this.writer = null;
    this.port = null;
    this.readLoopActive = false;
    try {
      await reader?.cancel();
    } catch {}
    try {
      reader?.releaseLock();
    } catch {}
    try {
      writer?.releaseLock();
    } catch {}
    try {
      await port?.close();
    } catch {}
  }

  async readLoop() {
    const reader = this.reader;
    if (!reader) return;
    const decoder = new TextDecoder();
    try {
      while (this.readLoopActive) {
        const { value, done } = await reader.read();
        if (done) break;
        if (!value) continue;
        this.rxText += decoder.decode(value, { stream: true });
        let nl;
        while ((nl = this.rxText.indexOf("\n")) >= 0) {
          const line = this.rxText.slice(0, nl).trim();
          this.rxText = this.rxText.slice(nl + 1);
          if (line) {
            const msg = parseHostLine(line);
            if (msg) this._emitMessage(msg);
          }
        }
      }
    } catch {
      /* disconnect */
    } finally {
      this.readLoopActive = false;
      this.connected = false;
      this._emitConnection();
      void this.closePort();
    }
  }

  async writeLine(line) {
    if (!this.writer) return;
    try {
      const enc = new TextEncoder();
      await this.writer.write(enc.encode(line + "\n"));
    } catch {
      this.connected = false;
      this._emitConnection();
      void this.closePort();
    }
  }

  /** Ask the board to light the 5-LED strip. px=-1 means the whole strip. */
  sendLed(px, r, g, b, ms) {
    void this.writeLine(`{"t":"led","px":${px},"r":${r & 0xff},"g":${g & 0xff},"b":${b & 0xff},"ms":${ms}}`);
  }

  /** Tell the board which app mode the PC wants (best-effort hint). */
  sendMode(mode) {
    void this.writeLine(`{"t":"mode","v":"${mode}"}`);
  }
}
