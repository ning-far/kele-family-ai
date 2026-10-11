/// <reference lib="dom" />

/**
 * Web Serial API 的最小类型声明。
 *
 * 说明：类型定义 copied from easyinput-beatbox/app/src/vite-env.d.ts（同源 MIT/Apache 许可），
 * 逐字保留其 SerialPort / Serial / Navigator.serial 等声明，未改结构；仅加此来源注释。
 * DOM lib 默认不含 Web Serial 类型，device/link.ts 需要它才能在 strict 下通过 tsc。
 */

interface SerialPortInfo {
  usbVendorId?: number;
  usbProductId?: number;
}

interface SerialOptions {
  baudRate: number;
  dataBits?: number;
  stopBits?: number;
  parity?: string;
  bufferSize?: number;
  flowControl?: string;
}

interface SerialPort extends EventTarget {
  readonly readable: ReadableStream<Uint8Array> | null;
  readonly writable: WritableStream<Uint8Array> | null;
  getInfo(): SerialPortInfo;
  open(options: SerialOptions): Promise<void>;
  close(): Promise<void>;
}

interface SerialPortFilter {
  usbVendorId?: number;
  usbProductId?: number;
}

interface SerialPortRequestOptions {
  filters?: SerialPortFilter[];
}

interface Serial extends EventTarget {
  getPorts(): Promise<SerialPort[]>;
  requestPort(options?: SerialPortRequestOptions): Promise<SerialPort>;
}

interface Navigator {
  readonly serial: Serial;
}
