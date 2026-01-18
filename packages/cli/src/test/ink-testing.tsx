/**
 * Custom Ink testing utilities compatible with Ink 6 + React 19
 * 
 * This is a replacement for ink-testing-library which hasn't been updated
 * for Ink 6 / React 19 compatibility yet.
 */

import { EventEmitter } from 'node:events';
import { render as inkRender, type Instance as InkInstance } from 'ink';
import type { ReactElement } from 'react';

/**
 * Strip ANSI escape codes from a string
 */
export function stripAnsi(str: string): string {
  // eslint-disable-next-line no-control-regex
  return str.replace(/\x1B(?:[@-Z\\-_]|\[[0-?]*[ -/]*[@-~])/g, '');
}

class MockStdout extends EventEmitter {
  get columns() {
    return 100;
  }

  get rows() {
    return 80; // Large enough for any component
  }

  readonly frames: string[] = [];
  private _lastFrame?: string;

  write = (frame: string) => {
    this.frames.push(frame);
    this._lastFrame = frame;
    return true;
  };

  lastFrame = () => this._lastFrame;

  // Required stream methods
  clearLine = () => true;
  cursorTo = () => true;
  moveCursor = () => true;
  clearScreenDown = () => true;
}

class MockStderr extends EventEmitter {
  readonly frames: string[] = [];
  private _lastFrame?: string;

  write = (frame: string) => {
    this.frames.push(frame);
    this._lastFrame = frame;
    return true;
  };

  lastFrame = () => this._lastFrame;
}

class MockStdin extends EventEmitter {
  isTTY = true;
  data: string | null = null;

  constructor(options: { isTTY?: boolean } = {}) {
    super();
    this.isTTY = options.isTTY ?? true;
  }

  write = (data: string) => {
    this.data = data;
    this.emit('readable');
    this.emit('data', data);
  };

  setEncoding() {
    // Do nothing
  }

  setRawMode() {
    // Do nothing
  }

  resume() {
    // Do nothing
  }

  pause() {
    // Do nothing
  }

  ref() {
    // Do nothing
  }

  unref() {
    // Do nothing
  }

  read: () => string | null = () => {
    const { data } = this;
    this.data = null;
    return data;
  };
}

export type RenderInstance = {
  rerender: (tree: ReactElement) => void;
  unmount: () => void;
  cleanup: () => void;
  stdout: MockStdout;
  stderr: MockStderr;
  stdin: MockStdin;
  frames: string[];
  lastFrame: () => string | undefined;
  firstFrame: () => string | undefined;
};

const instances: InkInstance[] = [];

/**
 * Render an Ink component for testing
 * Compatible with Ink 6 + React 19
 */
export const render = (tree: ReactElement): RenderInstance => {
  const stdout = new MockStdout();
  const stderr = new MockStderr();
  const stdin = new MockStdin();

  const instance = inkRender(tree, {
    stdout: stdout as unknown as NodeJS.WriteStream,
    stderr: stderr as unknown as NodeJS.WriteStream,
    stdin: stdin as unknown as NodeJS.ReadStream,
    debug: true,
    exitOnCtrlC: false,
    patchConsole: false,
  });

  instances.push(instance);

  return {
    rerender: instance.rerender,
    unmount: instance.unmount,
    cleanup: instance.cleanup,
    stdout,
    stderr,
    stdin,
    frames: stdout.frames,
    lastFrame: stdout.lastFrame,
    firstFrame: () => stdout.frames[0],
  };
};

/**
 * Cleanup all rendered instances
 */
export const cleanup = () => {
  for (const instance of instances) {
    instance.unmount();
    instance.cleanup();
  }
  instances.length = 0;
};
