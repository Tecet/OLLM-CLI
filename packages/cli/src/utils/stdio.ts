import { coreEvents } from './events.js';
import process from 'node:process';

// Capture the original stdout and stderr write methods before any monkey patching occurs.
const originalStdoutWrite = process.stdout.write.bind(process.stdout);
const originalStderrWrite = process.stderr.write.bind(process.stderr);

/**
 * Writes to the real stdout, bypassing any monkey patching on process.stdout.write.
 */
export function writeToStdout(
  ...args: Parameters<typeof process.stdout.write>
): boolean {
  return originalStdoutWrite(...args);
}

/**
 * Writes to the real stderr, bypassing any monkey patching on process.stderr.write.
 */
export function writeToStderr(
  ...args: Parameters<typeof process.stderr.write>
): boolean {
  return originalStderrWrite(...args);
}

/**
 * Monkey patches process.stdout.write and process.stderr.write to redirect output to the provided logger.
 * This prevents stray output from libraries (or the app itself) from corrupting the UI.
 * Returns a cleanup function that restores the original write methods.
 */
export function patchStdio(): () => void {
  const previousStdoutWrite = process.stdout.write;
  const previousStderrWrite = process.stderr.write;

  // Buffers to coalesce rapid writes and prevent event storms
  let stdoutBuffer = '';
  let stderrBuffer = '';
  let flushScheduled = false;
  let lastEmitted = '';
  let lastEmittedAt = 0;

  const scheduleFlush = () => {
    if (flushScheduled) return;
    flushScheduled = true;
    setTimeout(() => {
      const now = Date.now();
      try {
        if (stdoutBuffer) {
          const s = stdoutBuffer;
          if (!(s === lastEmitted && now - lastEmittedAt < 1000)) {
            coreEvents.emitOutput(false, s);
            lastEmitted = s;
            lastEmittedAt = now;
          }
        }
        if (stderrBuffer) {
          const s = stderrBuffer;
          if (!(s === lastEmitted && now - lastEmittedAt < 1000)) {
            coreEvents.emitOutput(true, s);
            lastEmitted = s;
            lastEmittedAt = now;
          }
        }
      } finally {
        stdoutBuffer = '';
        stderrBuffer = '';
        flushScheduled = false;
      }
    }, 20);
  };

  // Intercept stdin data to handle bracketed paste sequences (\x1b[200~ ... \x1b[201~)
  // Coalesce pasted content into a single 'data' emit to avoid per-character events.
  const previousStdinEmit = process.stdin.emit.bind(process.stdin as NodeJS.ReadStream & NodeJS.EventEmitter);
  let stdinAcc = '';
  let inPaste = false;
  let pasteBuffer = '';

  (process.stdin as NodeJS.ReadStream & NodeJS.EventEmitter).emit = function (event: string, chunk?: Buffer | string) {
    if (event !== 'data' || !chunk) {
      return previousStdinEmit(event, chunk);
    }

    try {
      const text = Buffer.isBuffer(chunk) ? chunk.toString('utf8') : String(chunk);
      stdinAcc += text;

      const START = '\x1b[200~';
      const END = '\x1b[201~';

      while (stdinAcc.length > 0) {
        if (!inPaste) {
          const si = stdinAcc.indexOf(START);
          if (si === -1) {
            // No paste start; emit everything
            const out = stdinAcc;
            stdinAcc = '';
            previousStdinEmit('data', Buffer.from(out, 'utf8'));
            break;
          }

          if (si > 0) {
            const leading = stdinAcc.slice(0, si);
            stdinAcc = stdinAcc.slice(si);
            previousStdinEmit('data', Buffer.from(leading, 'utf8'));
            continue;
          }

          // si === 0 -> start marker at beginning
          inPaste = true;
          stdinAcc = stdinAcc.slice(START.length);
          pasteBuffer = '';
          continue;
        }

        // inPaste === true
        const ei = stdinAcc.indexOf(END);
        if (ei === -1) {
          // accumulate and wait for more
          pasteBuffer += stdinAcc;
          stdinAcc = '';
          break;
        }

        // end found
        pasteBuffer += stdinAcc.slice(0, ei);
        stdinAcc = stdinAcc.slice(ei + END.length);
        // emit single data event for the whole paste
        previousStdinEmit('data', Buffer.from(pasteBuffer, 'utf8'));
        pasteBuffer = '';
        inPaste = false;
        // loop continues to handle remaining data
      }
    } catch (_err) {
      return previousStdinEmit(event, chunk);
    }

    return true;
  } as typeof process.stdin.emit;

  process.stdout.write = (
    chunk: Uint8Array | string,
    encodingOrCb?:
      | BufferEncoding
      | ((err?: NodeJS.ErrnoException | null) => void),
    cb?: (err?: NodeJS.ErrnoException | null) => void,
  ) => {
    const encoding = typeof encodingOrCb === 'string' ? encodingOrCb : undefined;
    try {
      const text =
        typeof chunk === 'string' ? chunk : Buffer.from(chunk).toString(encoding || 'utf8');
      stdoutBuffer += text;
      scheduleFlush();
    } catch (_err) {
      // fallback to immediate emit on error
      coreEvents.emitOutput(false, chunk, encoding);
    }
    const callback = typeof encodingOrCb === 'function' ? encodingOrCb : cb;
    if (callback) {
      callback();
    }
    return true;
  };

  process.stderr.write = (
    chunk: Uint8Array | string,
    encodingOrCb?:
      | BufferEncoding
      | ((err?: NodeJS.ErrnoException | null) => void),
    cb?: (err?: NodeJS.ErrnoException | null) => void,
  ) => {
    const encoding = typeof encodingOrCb === 'string' ? encodingOrCb : undefined;
    try {
      const text =
        typeof chunk === 'string' ? chunk : Buffer.from(chunk).toString(encoding || 'utf8');
      stderrBuffer += text;
      scheduleFlush();
    } catch (_err) {
      coreEvents.emitOutput(true, chunk, encoding);
    }
    const callback = typeof encodingOrCb === 'function' ? encodingOrCb : cb;
    if (callback) {
      callback();
    }
    return true;
  };

  return () => {
    process.stdout.write = previousStdoutWrite;
    process.stderr.write = previousStderrWrite;
    // restore stdin emit
    try {
      (process.stdin as NodeJS.ReadStream & NodeJS.EventEmitter).emit = previousStdinEmit;
    } catch (_e) {
      // ignore
    }
  };
}

/**
 * Creates proxies for process.stdout and process.stderr that use the real write methods
 * (writeToStdout and writeToStderr) bypassing any monkey patching.
 * This is used to write to the real output even when stdio is patched.
 */
export function createWorkingStdio() {
  const inkStdout = new Proxy(process.stdout, {
    get(target, prop, receiver) {
      if (prop === 'write') {
        return writeToStdout;
      }
      const value = Reflect.get(target, prop, receiver);
      if (typeof value === 'function') {
        return value.bind(target);
      }
      return value;
    },
  });

  const inkStderr = new Proxy(process.stderr, {
    get(target, prop, receiver) {
      if (prop === 'write') {
        return writeToStderr;
      }
      const value = Reflect.get(target, prop, receiver);
      if (typeof value === 'function') {
        return value.bind(target);
      }
      return value;
    },
  });

  return { stdout: inkStdout, stderr: inkStderr };
}
