/**
 * Unit tests for shared service types
 * Feature: services-sessions
 */

import { describe, it, expect } from 'vitest';
import * as fc from 'fast-check';
import type {
  SessionMessage,
  SessionToolCall,
  Session,
  CompressionOptions,
  LoopDetectionConfig,
  ContextEntry,
  SanitizationConfig,
} from '../types.js';
import {
  sessionMessage,
  sessionToolCall,
  session,
  contextEntry,
  isValidISO8601,
  isValidUUID,
} from './test-helpers.js';

describe('Service Types', () => {
  describe('SessionMessage', () => {
    it('should have valid structure', () => {
      fc.assert(
        fc.property(sessionMessage(), (msg) => {
          expect(msg).toHaveProperty('role');
          expect(msg).toHaveProperty('parts');
          expect(msg).toHaveProperty('timestamp');
          expect(['user', 'assistant', 'system']).toContain(msg.role);
          expect(Array.isArray(msg.parts)).toBe(true);
          expect(msg.parts.length).toBeGreaterThan(0);
          expect(isValidISO8601(msg.timestamp)).toBe(true);
        }),
        { numRuns: 100 }
      );
    });

    it('should have valid message parts', () => {
      fc.assert(
        fc.property(sessionMessage(), (msg) => {
          msg.parts.forEach((part) => {
            expect(part).toHaveProperty('type');
            expect(part.type).toBe('text');
            expect(part).toHaveProperty('text');
            expect(typeof part.text).toBe('string');
          });
        }),
        { numRuns: 100 }
      );
    });
  });

  describe('SessionToolCall', () => {
    it('should have valid structure', () => {
      fc.assert(
        fc.property(sessionToolCall(), (toolCall) => {
          expect(toolCall).toHaveProperty('id');
          expect(toolCall).toHaveProperty('name');
          expect(toolCall).toHaveProperty('args');
          expect(toolCall).toHaveProperty('result');
          expect(toolCall).toHaveProperty('timestamp');
          expect(isValidUUID(toolCall.id)).toBe(true);
          expect(typeof toolCall.name).toBe('string');
          expect(typeof toolCall.args).toBe('object');
          expect(isValidISO8601(toolCall.timestamp)).toBe(true);
        }),
        { numRuns: 100 }
      );
    });

    it('should have valid result structure', () => {
      fc.assert(
        fc.property(sessionToolCall(), (toolCall) => {
          expect(toolCall.result).toHaveProperty('llmContent');
          expect(typeof toolCall.result.llmContent).toBe('string');
          if (toolCall.result.returnDisplay !== undefined) {
            expect(typeof toolCall.result.returnDisplay).toBe('string');
          }
        }),
        { numRuns: 100 }
      );
    });
  });

  describe('Session', () => {
    it('should have valid structure', () => {
      fc.assert(
        fc.property(session(), (sess) => {
          expect(sess).toHaveProperty('sessionId');
          expect(sess).toHaveProperty('startTime');
          expect(sess).toHaveProperty('lastActivity');
          expect(sess).toHaveProperty('model');
          expect(sess).toHaveProperty('provider');
          expect(sess).toHaveProperty('messages');
          expect(sess).toHaveProperty('toolCalls');
          expect(sess).toHaveProperty('metadata');
          expect(isValidUUID(sess.sessionId)).toBe(true);
          expect(isValidISO8601(sess.startTime)).toBe(true);
          expect(isValidISO8601(sess.lastActivity)).toBe(true);
          expect(Array.isArray(sess.messages)).toBe(true);
          expect(Array.isArray(sess.toolCalls)).toBe(true);
        }),
        { numRuns: 100 }
      );
    });

    it('should have valid metadata', () => {
      fc.assert(
        fc.property(session(), (sess) => {
          expect(sess.metadata).toHaveProperty('tokenCount');
          expect(sess.metadata).toHaveProperty('compressionCount');
          expect(typeof sess.metadata.tokenCount).toBe('number');
          expect(typeof sess.metadata.compressionCount).toBe('number');
          expect(sess.metadata.tokenCount).toBeGreaterThanOrEqual(0);
          expect(sess.metadata.compressionCount).toBeGreaterThanOrEqual(0);
        }),
        { numRuns: 100 }
      );
    });

    it('should have at least one message', () => {
      fc.assert(
        fc.property(session(), (sess) => {
          expect(sess.messages.length).toBeGreaterThan(0);
        }),
        { numRuns: 100 }
      );
    });
  });

  describe('ContextEntry', () => {
    it('should have valid structure', () => {
      fc.assert(
        fc.property(contextEntry(), (entry) => {
          expect(entry).toHaveProperty('key');
          expect(entry).toHaveProperty('content');
          expect(entry).toHaveProperty('priority');
          expect(entry).toHaveProperty('source');
          expect(entry).toHaveProperty('timestamp');
          expect(typeof entry.key).toBe('string');
          expect(typeof entry.content).toBe('string');
          expect(typeof entry.priority).toBe('number');
          expect(['hook', 'extension', 'user', 'system']).toContain(entry.source);
          expect(isValidISO8601(entry.timestamp)).toBe(true);
        }),
        { numRuns: 100 }
      );
    });

    it('should have valid priority range', () => {
      fc.assert(
        fc.property(contextEntry(), (entry) => {
          expect(entry.priority).toBeGreaterThanOrEqual(0);
          expect(entry.priority).toBeLessThanOrEqual(100);
        }),
        { numRuns: 100 }
      );
    });
  });

  describe('Type Serialization', () => {
    it('should serialize and deserialize SessionMessage', () => {
      fc.assert(
        fc.property(sessionMessage(), (msg) => {
          const json = JSON.stringify(msg);
          const parsed: SessionMessage = JSON.parse(json);
          expect(parsed).toEqual(msg);
        }),
        { numRuns: 100 }
      );
    });

    it('should serialize and deserialize SessionToolCall', () => {
      fc.assert(
        fc.property(sessionToolCall(), (toolCall) => {
          const json = JSON.stringify(toolCall);
          const parsed: SessionToolCall = JSON.parse(json);
          expect(parsed).toEqual(toolCall);
        }),
        { numRuns: 100 }
      );
    });

    it('should serialize and deserialize Session', () => {
      fc.assert(
        fc.property(session(), (sess) => {
          const json = JSON.stringify(sess);
          const parsed: Session = JSON.parse(json);
          expect(parsed).toEqual(sess);
        }),
        { numRuns: 100 }
      );
    });

    it('should serialize and deserialize ContextEntry', () => {
      fc.assert(
        fc.property(contextEntry(), (entry) => {
          const json = JSON.stringify(entry);
          const parsed: ContextEntry = JSON.parse(json);
          expect(parsed).toEqual(entry);
        }),
        { numRuns: 100 }
      );
    });
  });

  describe('CompressionStrategy', () => {
    it('should only allow valid strategies', () => {
      const validStrategies: Array<'summarize' | 'truncate' | 'hybrid'> = [
        'summarize',
        'truncate',
        'hybrid',
      ];
      
      validStrategies.forEach((strategy) => {
        const options: CompressionOptions = {
          strategy,
          preserveRecentTokens: 4096,
        };
        expect(options.strategy).toBe(strategy);
      });
    });
  });

  describe('LoopDetectionConfig', () => {
    it('should have valid default values', () => {
      const config: LoopDetectionConfig = {
        maxTurns: 50,
        repeatThreshold: 3,
        enabled: true,
      };
      
      expect(config.maxTurns).toBe(50);
      expect(config.repeatThreshold).toBe(3);
      expect(config.enabled).toBe(true);
    });
  });

  describe('SanitizationConfig', () => {
    it('should have valid structure', () => {
      const config: SanitizationConfig = {
        allowList: ['PATH', 'HOME', 'USER'],
        denyPatterns: ['*_KEY', '*_SECRET', '*_TOKEN'],
      };
      
      expect(Array.isArray(config.allowList)).toBe(true);
      expect(Array.isArray(config.denyPatterns)).toBe(true);
      expect(config.allowList.length).toBeGreaterThan(0);
      expect(config.denyPatterns.length).toBeGreaterThan(0);
    });
  });
});
