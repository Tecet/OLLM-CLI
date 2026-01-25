/* eslint-disable @typescript-eslint/no-require-imports */
import { Console as NodeConsole } from 'console';

import * as fc from 'fast-check';

// Allow overriding runs via env var for CI or local experimentation
const runs = parseInt(process.env.FAST_CHECK_RUNS || '20', 10);
if (!Number.isNaN(runs)) {
  fc.configureGlobal({ numRuns: runs });
}

// Reduce console noise during tests unless explicitly requested.
// When `VERBOSE_TESTS` is not set, mute non-error console output so test
// runner output shows only pass/fail (the reporter controls test lines).
if (!process.env.VERBOSE_TESTS) {
  console.log = () => {};
  console.info = () => {};
  console.debug = () => {};
  console.warn = () => {};
}

if (!console.Console) {
  (console as { Console?: typeof NodeConsole }).Console = NodeConsole;
}
 
// Note: we avoid attempting to override `fc.assert` because some fast-check
// builds expose a non-configurable `assert` property which causes runtime
// errors when redefined. Rely on `fc.configureGlobal({ numRuns })` above and
// prefer editing tests that explicitly pass large `numRuns` when necessary.

export {};

// Sanitize logged values to avoid dumping function/spy internals.
// Prefixed with underscore to avoid unused-var lint failures when not used.
function _sanitizeForLog(value: unknown, depth = 0): unknown {
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
      return anyVal.map((v) => _sanitizeForLog(v, depth + 1));
    }

    const out: Record<string, unknown> = {};
    for (const k of Object.keys(anyVal)) {
      try {
        const v = anyVal[k];
          if (typeof v === 'function') {
            out[k] = '[Function]';
          } else {
            out[k] = _sanitizeForLog(v, depth + 1);
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
   
  const childProcess = require('child_process');
  const { resolve } = require('path');

  const origSpawn = childProcess.spawn;
  const projectRoot = resolve(__dirname, '.');
  const echoMock = resolve(projectRoot, 'packages/test-utils/bin/echo-mock.js');
  const jsonRpcMock = resolve(projectRoot, 'packages/test-utils/bin/jsonrpc-mock.js');

  function patchedSpawn(command: any, argv?: any, options?: any) {
    try {
      // Normalize args/options for the common call signatures
      const cmd = command;
      const args = Array.isArray(argv) ? argv : [];
      const opts = (Array.isArray(argv) ? options : argv) || {};

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
    // Call original spawn with the normalized args
    return origSpawn.call(childProcess, command, argv, options);
  }

  // Patch spawn in the child_process module for the duration of the test run
  childProcess.spawn = patchedSpawn;
} catch (err: unknown) {
  // If patching fails, do not break the test setup; tests will run with
  // original behavior (may be noisier on some platforms).
  
  const errMsg = err instanceof Error ? err.message : String(err);
  console.warn('Failed to install spawn shim for tests:', errMsg);
}
