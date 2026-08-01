// Best-effort runtime error tracing: captures window `error` and
// `unhandledrejection` events with parsed stack frames during pin mode.
// Results are attached to the pin so the AI can trace a reported bug back
// to the throwing module. All parsing is defensive and never throws.

export interface ErrorFrame {
  fn: string;
  file: string;
  line: number;
  col: number;
}

export interface CapturedError {
  type: 'error' | 'unhandledrejection';
  name: string;
  message: string;
  /** Short source location, e.g. `test.html:214:12`. */
  location: string;
  /** Parsed stack frames, most recent first. */
  stack: ErrorFrame[];
  timestamp: number;
}

const MAX_CAPTURED = 20;
const WINDOW_MS = 120000;

// V8/Chrome:    "    at fnName (file.js:12:34)"  or  "    at file.js:12:34"
const V8_RE = /^\s*at\s+(?:([^(]+?)\s*\()?(.*?):(\d+):(\d+)\)?\s*$/;
// Firefox:      "fnName@file.js:12:34"  or  "file.js:12:34"
const FF_RE = /^(.*?)@(.*?):(\d+):(\d+)\s*$/;

/** Shorten a script URL to its last two path segments for readable pins. */
function shortFile(file: string): string {
  const segments = file.split('/');
  return segments.slice(-2).join('/') || file;
}

/** Parse a raw stack string into structured frames; returns [] on unparseable input. */
export function parseStack(stack: string | undefined): ErrorFrame[] {
  if (!stack) return [];
  const frames: ErrorFrame[] = [];
  for (const rawLine of stack.split('\n')) {
    const line = rawLine.trim();
    if (!line) continue;

    let fn = '';
    let file = '';
    let lineNo = 0;
    let colNo = 0;
    let matched = false;

    const v8 = line.match(V8_RE);
    if (v8) {
      fn = (v8[1] || '').trim();
      file = shortFile(v8[2]);
      lineNo = Number(v8[3]);
      colNo = Number(v8[4]);
      matched = true;
    } else {
      const ff = line.match(FF_RE);
      if (ff) {
        fn = ff[1].trim();
        file = shortFile(ff[2]);
        lineNo = Number(ff[3]);
        colNo = Number(ff[4]);
        matched = true;
      }
    }

    if (!matched) continue;
    if (!file && !lineNo) continue;
    frames.push({ fn, file, line: lineNo, col: colNo });
  }
  return frames;
}

function toCaptured(
  type: 'error' | 'unhandledrejection',
  name: string,
  message: string,
  rawStack: string | undefined,
  location: string,
): CapturedError {
  const stack = parseStack(rawStack);
  return {
    type,
    name: name || (type === 'unhandledrejection' ? 'UnhandledRejection' : 'Error'),
    message,
    location,
    stack,
    timestamp: Date.now(),
  };
}

export class ErrorStackTracer {
  private errors: CapturedError[] = [];
  private handlers: Array<[string, EventListener]> = [];
  private enabled = false;

  private onError = (event: Event) => {
    const errEvent = event as ErrorEvent;
    const rawStack = errEvent.error && typeof (errEvent.error as Error).stack === 'string'
      ? (errEvent.error as Error).stack
      : undefined;
    const name = errEvent.error && (errEvent.error as Error).name
      ? (errEvent.error as Error).name
      : 'Error';
    const message = errEvent.message || ((errEvent.error as Error)?.message ?? 'Uncaught error');
    const location = rawStack
      ? (this.firstFrameLocation(rawStack) || `${shortFile(errEvent.filename)}:${errEvent.lineno}:${errEvent.colno}`)
      : `${shortFile(errEvent.filename)}:${errEvent.lineno}:${errEvent.colno}`;
    this.push(toCaptured('error', name, message, rawStack, location));
  };

  private onUnhandledRejection = (event: Event) => {
    const rejectEvent = event as PromiseRejectionEvent;
    const reason: any = rejectEvent.reason;
    const isErrorLike = reason && (typeof reason.message === 'string' || typeof reason.stack === 'string');
    const name = isErrorLike && reason.name ? String(reason.name) : 'UnhandledRejection';
    const message = isErrorLike && reason.message ? String(reason.message) : String(reason);
    const rawStack = isErrorLike && typeof reason.stack === 'string' ? reason.stack : undefined;
    const location = rawStack
      ? (this.firstFrameLocation(rawStack) || 'unknown')
      : 'no stack (rejection value was not an Error)';
    this.push(toCaptured('unhandledrejection', name, message, rawStack, location));
  };

  /** Extract "file:line:col" from the first parseable stack frame. */
  private firstFrameLocation(rawStack: string): string {
    const first = parseStack(rawStack)[0];
    if (!first) return '';
    return `${first.file}:${first.line}:${first.col}`;
  }

  private push(err: CapturedError) {
    this.errors.push(err);
    const cutoff = Date.now() - WINDOW_MS;
    this.errors = this.errors.filter((e) => e.timestamp >= cutoff);
    if (this.errors.length > MAX_CAPTURED) {
      this.errors = this.errors.slice(this.errors.length - MAX_CAPTURED);
    }
  }

  enable() {
    if (this.enabled) return;
    this.enabled = true;
    const install = (type: string, handler: EventListener) => {
      window.addEventListener(type, handler, true);
      this.handlers.push([type, handler]);
    };
    install('error', this.onError);
    install('unhandledrejection', this.onUnhandledRejection);
  }

  disable() {
    if (!this.enabled) return;
    this.enabled = false;
    for (const [type, handler] of this.handlers) {
      window.removeEventListener(type, handler, true);
    }
    this.handlers = [];
  }

  /** Errors captured since enable(), oldest first. */
  getErrors(): CapturedError[] {
    return [...this.errors];
  }

  clear() {
    this.errors = [];
  }
}
