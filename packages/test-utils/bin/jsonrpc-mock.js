#!/usr/bin/env node
/* eslint-disable @typescript-eslint/no-require-imports */
// Tiny JSON-RPC mock server for tests
// Usage: spawn this script and communicate via stdin/stdout using JSON-RPC 2.0 lines

const readline = require('readline');

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout,
  terminal: false,
});

function sendResponse(obj) {
  try {
    process.stdout.write(JSON.stringify(obj) + '\n');
  } catch (_e) {
    // ignore
  }
}

rl.on('line', (line) => {
  const text = String(line || '').trim();
  if (!text) return;

  let msg;
  try {
    msg = JSON.parse(text);
  } catch (_err) {
    // Ignore non-JSON lines to remain tolerant when test harnesses emit other output.
    if (process.env.NODE_ENV !== 'test' && !process.env.VITEST) {
      console.error('jsonrpc-mock: ignored non-json input:', text);
    }
    return;
  }

  const id = msg.id;
  const method = msg.method;
  const params = msg.params;

  // Notifications (no id) -> no response
  if (typeof id === 'undefined') return;

  // Minimal handlers
  if (method === 'initialize') {
    sendResponse({
      jsonrpc: '2.0',
      id,
      result: {
        server: 'jsonrpc-mock',
        version: '0.0.1',
        capabilities: {},
      },
    });
    return;
  }

  if (method === 'tools/list') {
    sendResponse({
      jsonrpc: '2.0',
      id,
      result: { tools: [{ name: 'mock-tool', description: 'A test tool' }] },
    });
    return;
  }

  // Default: echo params back
  sendResponse({ jsonrpc: '2.0', id, result: { echo: params } });
});

rl.on('close', () => {
  process.exit(0);
});
