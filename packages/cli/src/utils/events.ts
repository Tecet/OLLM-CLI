import { EventEmitter } from 'node:events';

/**
 * Payload for the 'output' event.
 */
export interface OutputPayload {
  isStderr: boolean;
  chunk: Uint8Array | string;
  encoding?: BufferEncoding;
}

export enum CoreEvent {
  Output = 'output',
}

export interface CoreEvents {
  [CoreEvent.Output]: [OutputPayload];
}

export class CoreEventEmitter extends EventEmitter {
  constructor() {
    super();
  }

  /**
   * Broadcasts stdout/stderr output.
   */
  emitOutput(isStderr: boolean, chunk: Uint8Array | string, encoding?: BufferEncoding): void {
    const payload: OutputPayload = { isStderr, chunk, encoding };
    this.emit(CoreEvent.Output, payload);
  }
}

export const coreEvents = new CoreEventEmitter();
