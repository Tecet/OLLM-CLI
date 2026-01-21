import * as fc from 'fast-check';

// Allow overriding runs via env var for CI or local experimentation
const runs = parseInt(process.env.FAST_CHECK_RUNS || '20', 10);
if (!Number.isNaN(runs)) {
  fc.configureGlobal({ numRuns: runs });
}

// Reduce console noise during property tests unless explicitly requested.
// Instead of muting all logs, filter out known noisy patterns so useful
// output (errors/warnings and other logs) remains available.
const _origLog = console.log.bind(console);
const _origInfo = console.info.bind(console);
if (!process.env.VERBOSE_TESTS) {
  const suppressedPatterns: Array<string | RegExp> = [
    '\\[HooksProvider\\]',
    'getHookSettings',
    'settingsService identity',
  ];

  const shouldSuppress = (args: unknown[]) => {
    try {
      const text = args
        .map((a) => {
          if (typeof a === 'string') return a;
          try {
            return JSON.stringify(a);
          } catch {
            return String(a);
          }
        })
        .join(' ');
      return suppressedPatterns.some((p) =>
        typeof p === 'string' ? text.includes(p) : p.test(text),
      );
    } catch {
      return false;
    }
  };

  console.log = (...args: unknown[]) => {
    if (shouldSuppress(args)) return;
    try {
      const sanitized = args.map((a) => sanitizeForLog(a));
      _origLog(...(sanitized as any));
    } catch (_e) {
      _origLog(...(args as any));
    }
  };

  console.info = (...args: unknown[]) => {
    if (shouldSuppress(args)) return;
    try {
      const sanitized = args.map((a) => sanitizeForLog(a));
      _origInfo(...(sanitized as any));
    } catch (_e) {
      _origInfo(...(args as any));
    }
  };
}
 
// Note: we avoid attempting to override `fc.assert` because some fast-check
// builds expose a non-configurable `assert` property which causes runtime
// errors when redefined. Rely on `fc.configureGlobal({ numRuns })` above and
// prefer editing tests that explicitly pass large `numRuns` when necessary.

export {};

// Sanitize logged values to avoid dumping function/spy internals.
function sanitizeForLog(value: unknown, depth = 0): unknown {
  if (depth > 3) return '[Object]';
  if (value === null || value === undefined) return value;
  const t = typeof value;
  if (t === 'function') return '[Function]';
  if (t === 'symbol') return value.toString();
  if (t !== 'object') return value;

  try {
    // Detect common vi.fn spy shape by presence of mock/mockName etc.
    const anyVal = value as any;
    if (anyVal && (anyVal.getMockName || anyVal.mockName || anyVal.getMockImplementation)) {
      return '[Spy]';
    }

    if (Array.isArray(anyVal)) {
      return anyVal.map((v) => sanitizeForLog(v, depth + 1));
    }

    const out: Record<string, unknown> = {};
    for (const k of Object.keys(anyVal)) {
      try {
        const v = anyVal[k];
        if (typeof v === 'function') {
          out[k] = '[Function]';
        } else {
          out[k] = sanitizeForLog(v, depth + 1);
        }
      } catch {
        out[k] = '[Unserializable]';
      }
    }
    return out;
  } catch {
    return '[Object]';
  }
}

// During test runs, some tests spawn simple shell built-ins like `echo`
// or rely on `npx` being present. On Windows or in minimal CI images
// those can produce ENOENT or produce non-JSON output that pollutes tests.
// Patch `child_process.spawn` in the test environment to route a couple
// of known problematic commands to lightweight test helpers.
try {
  // Use require to avoid ESM import complexity in the test setup file
  // and to ensure this runs in Node test harness.
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  const childProcess = require('child_process');
  const { resolve } = require('path');

  const origSpawn = childProcess.spawn;
  const projectRoot = resolve(__dirname, '.');
  const echoMock = resolve(projectRoot, 'packages/test-utils/bin/echo-mock.js');
  const jsonRpcMock = resolve(projectRoot, 'packages/test-utils/bin/jsonrpc-mock.js');

  function patchedSpawn(command: any, argv?: any, options?: any) {
    try {
      // Normalize args/options for the common call signatures
      let cmd = command;
      let args = Array.isArray(argv) ? argv : [];
      let opts = (Array.isArray(argv) ? options : argv) || {};

      const base = typeof cmd === 'string' ? cmd.split(/[\\/]/).pop() : '';

      // Redirect `echo` to our small Node shim (consistent across platforms)
      if (base === 'echo') {
        return origSpawn('node', [echoMock, ...args], { ...opts, shell: false });
      }

      // Redirect `npx` invocations to the JSON-RPC mock to avoid ENOENT
      // and to provide predictable JSON-RPC responses when tests expect them.
      if (base === 'npx') {
        return origSpawn('node', [jsonRpcMock, ...args], { ...opts, shell: false });
      }
    } catch (_err) {
      // Fall through to default spawn on unexpected errors
    }

    // Default behavior
    // @ts-expect-error - pass through original types
    return origSpawn.apply(childProcess, arguments as any);
  }

  // Patch spawn in the child_process module for the duration of the test run
  childProcess.spawn = patchedSpawn;
} catch (err) {
  // If patching fails, do not break the test setup; tests will run with
  // original behavior (may be noisier on some platforms).
  // eslint-disable-next-line no-console
  console.warn('Failed to install spawn shim for tests:', err?.message || err);
}
