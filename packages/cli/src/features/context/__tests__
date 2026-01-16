/**
 * Basic smoke tests for context providers
 */

import { describe, it, expect } from 'vitest';
import {
  UIProvider,
  GPUProvider,
  ChatProvider,
  ReviewProvider,
  TabType,
  useUI,
  useGPU,
  useChat,
  useReview,
} from '../index';

describe('Context Providers', () => {
  describe('UIProvider', () => {
    it('should export UIProvider', () => {
      expect(UIProvider).toBeDefined();
      expect(typeof UIProvider).toBe('function');
    });

    it('should export useUI hook', () => {
      expect(useUI).toBeDefined();
      expect(typeof useUI).toBe('function');
    });

    it('should export TabType', () => {
      const tab: TabType = 'chat';
      expect(tab).toBe('chat');
    });
  });

  describe('GPUProvider', () => {
    it('should export GPUProvider', () => {
      expect(GPUProvider).toBeDefined();
      expect(typeof GPUProvider).toBe('function');
    });

    it('should export useGPU hook', () => {
      expect(useGPU).toBeDefined();
      expect(typeof useGPU).toBe('function');
    });
  });

  describe('ChatProvider', () => {
    it('should export ChatProvider', () => {
      expect(ChatProvider).toBeDefined();
      expect(typeof ChatProvider).toBe('function');
    });

    it('should export useChat hook', () => {
      expect(useChat).toBeDefined();
      expect(typeof useChat).toBe('function');
    });
  });

  describe('ReviewProvider', () => {
    it('should export ReviewProvider', () => {
      expect(ReviewProvider).toBeDefined();
      expect(typeof ReviewProvider).toBe('function');
    });

    it('should export useReview hook', () => {
      expect(useReview).toBeDefined();
      expect(typeof useReview).toBe('function');
    });
  });
});
