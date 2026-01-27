/**
 * Input Preprocessor Tests
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { InputPreprocessor } from '../inputPreprocessor.js';
import { MockProvider } from '@ollm/test-utils';
import type { TokenCounter } from '../../context/types.js';

describe('InputPreprocessor', () => {
  let preprocessor: InputPreprocessor;
  let mockProvider: MockProvider;
  let mockTokenCounter: TokenCounter;

  beforeEach(() => {
    mockProvider = new MockProvider({
      eventSequence: [
        { type: 'text', value: '{"intent":"Test","keyPoints":[],"typosFixed":0,"attachments":[]}' },
        { type: 'finish', reason: 'stop' },
      ],
    });
    
    // Mock token counter
    mockTokenCounter = {
      countTokens: async (text: string) => Math.ceil(text.length / 4),
      countTokensCached: (id: string, text: string) => Math.ceil(text.length / 4),
      countConversationTokens: (messages: any[]) => 
        messages.reduce((sum, m) => sum + Math.ceil(m.content.length / 4), 0),
      clearCache: () => {},
      getMetrics: () => ({
        cacheHitRate: '0%',
        cacheHits: 0,
        cacheMisses: 0,
        recalculations: 0,
        totalTokensCounted: 0,
        largestMessage: 0,
        avgTokensPerMessage: 0,
        uptimeSeconds: 0,
      }),
      resetMetrics: () => {},
    } as TokenCounter;

    preprocessor = new InputPreprocessor(
      mockProvider,
      mockTokenCounter,
      {
        enabled: true,
        tokenThreshold: 500,
        alwaysClarify: true,
        autoPropose: true,
        storeSnapshots: true,
      }
    );
  });

  describe('shouldPreprocess', () => {
    it('should return false for short messages', () => {
      const shortMessage = 'Hello world';
      expect(preprocessor.shouldPreprocess(shortMessage)).toBe(false);
    });

    it('should return true for long messages', () => {
      const longMessage = 'a'.repeat(2500); // ~625 tokens
      expect(preprocessor.shouldPreprocess(longMessage)).toBe(true);
    });

    it('should respect enabled config', () => {
      preprocessor.updateConfig({ enabled: false });
      const longMessage = 'a'.repeat(2500);
      expect(preprocessor.shouldPreprocess(longMessage)).toBe(false);
    });

    it('should respect token threshold', () => {
      preprocessor.updateConfig({ tokenThreshold: 1000 });
      const mediumMessage = 'a'.repeat(2500); // ~625 tokens
      expect(preprocessor.shouldPreprocess(mediumMessage)).toBe(false);
      
      const longMessage = 'a'.repeat(5000); // ~1250 tokens
      expect(preprocessor.shouldPreprocess(longMessage)).toBe(true);
    });
  });

  describe('preprocess', () => {
    it('should not trigger for short messages', async () => {
      const shortMessage = 'Hello world';
      const result = await preprocessor.preprocess(shortMessage);
      
      expect(result.triggered).toBe(false);
      expect(result.cleanMessage).toBe(shortMessage);
      expect(result.extracted).toBeUndefined();
    });
  });

  describe('createSnapshot', () => {
    it('should create intent snapshot', async () => {
      const original = 'Original message';
      const extracted = {
        intent: 'Test intent',
        keyPoints: ['Point 1'],
        typosFixed: 0,
        attachments: [],
        tokenSavings: 50,
      };
      
      const snapshot = await preprocessor.createSnapshot(original, extracted);
      
      expect(snapshot.id).toMatch(/^intent-/);
      expect(snapshot.original).toBe(original);
      expect(snapshot.extracted).toEqual(extracted);
      expect(snapshot.confirmed).toBe(false);
      expect(snapshot.timestamp).toBeInstanceOf(Date);
    });

    it('should include proposed goal in snapshot', async () => {
      const original = 'Original message';
      const extracted = {
        intent: 'Test intent',
        keyPoints: ['Point 1'],
        typosFixed: 0,
        attachments: [],
        tokenSavings: 50,
      };
      const proposedGoal = {
        goal: 'Test goal',
        milestones: ['Milestone 1', 'Milestone 2'],
      };
      
      const snapshot = await preprocessor.createSnapshot(
        original,
        extracted,
        proposedGoal,
        true
      );
      
      expect(snapshot.proposedGoal).toEqual(proposedGoal);
      expect(snapshot.confirmed).toBe(true);
    });
  });

  describe('configuration', () => {
    it('should update configuration', () => {
      preprocessor.updateConfig({
        tokenThreshold: 1000,
        autoPropose: false,
      });
      
      const config = preprocessor.getConfig();
      expect(config.tokenThreshold).toBe(1000);
      expect(config.autoPropose).toBe(false);
      expect(config.enabled).toBe(true); // Unchanged
    });

    it('should get current configuration', () => {
      const config = preprocessor.getConfig();
      
      expect(config.enabled).toBe(true);
      expect(config.tokenThreshold).toBe(500);
      expect(config.alwaysClarify).toBe(true);
      expect(config.autoPropose).toBe(true);
      expect(config.storeSnapshots).toBe(true);
    });
  });
});
