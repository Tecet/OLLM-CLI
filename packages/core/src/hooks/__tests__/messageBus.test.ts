/**
 * Tests for MessageBus
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { MessageBus, getMessageBus, setMessageBus, resetMessageBus } from '../messageBus.js';

describe('MessageBus', () => {
  let bus: MessageBus;

  beforeEach(() => {
    bus = new MessageBus();
  });

  describe('on() and emit()', () => {
    it('should register and call a listener', async () => {
      const listener = vi.fn();
      bus.on('session_start', listener);

      await bus.emit('session_start', { test: 'data' });

      expect(listener).toHaveBeenCalledTimes(1);
      expect(listener).toHaveBeenCalledWith('session_start', { test: 'data' });
    });

    it('should call multiple listeners for the same event', async () => {
      const listener1 = vi.fn();
      const listener2 = vi.fn();

      bus.on('session_start', listener1);
      bus.on('session_start', listener2);

      await bus.emit('session_start', { test: 'data' });

      expect(listener1).toHaveBeenCalledTimes(1);
      expect(listener2).toHaveBeenCalledTimes(1);
    });

    it('should respect listener priority', async () => {
      const callOrder: number[] = [];

      bus.on('session_start', async () => { callOrder.push(1); }, { priority: 1 });
      bus.on('session_start', async () => { callOrder.push(3); }, { priority: 3 });
      bus.on('session_start', async () => { callOrder.push(2); }, { priority: 2 });

      await bus.emit('session_start', {});

      expect(callOrder).toEqual([3, 2, 1]);
    });

    it('should handle async listeners', async () => {
      const listener = vi.fn(async () => {
        await new Promise((resolve) => setTimeout(resolve, 10));
      });

      bus.on('session_start', listener);
      await bus.emit('session_start', {});

      expect(listener).toHaveBeenCalledTimes(1);
    });

    it('should not call listeners for different events', async () => {
      const listener = vi.fn();
      bus.on('session_start', listener);

      await bus.emit('session_end', {});

      expect(listener).not.toHaveBeenCalled();
    });

    it('should handle errors in listeners without stopping others', async () => {
      const listener1 = vi.fn(() => {
        throw new Error('Test error');
      });
      const listener2 = vi.fn();

      bus.on('session_start', listener1);
      bus.on('session_start', listener2);

      await bus.emit('session_start', {});

      expect(listener1).toHaveBeenCalledTimes(1);
      expect(listener2).toHaveBeenCalledTimes(1);
    });
  });

  describe('once()', () => {
    it('should call listener only once', async () => {
      const listener = vi.fn();
      bus.once('session_start', listener);

      await bus.emit('session_start', {});
      await bus.emit('session_start', {});

      expect(listener).toHaveBeenCalledTimes(1);
    });

    it('should remove listener after first call', async () => {
      const listener = vi.fn();
      bus.once('session_start', listener);

      await bus.emit('session_start', {});

      // Listener should be removed
      expect(bus.listenerCount('session_start')).toBe(0);
    });
  });

  describe('off()', () => {
    it('should remove a listener by ID', async () => {
      const listener = vi.fn();
      const listenerId = bus.on('session_start', listener);

      bus.off(listenerId);
      await bus.emit('session_start', {});

      expect(listener).not.toHaveBeenCalled();
    });

    it('should return true when listener is found and removed', () => {
      const listenerId = bus.on('session_start', vi.fn());
      const result = bus.off(listenerId);

      expect(result).toBe(true);
    });

    it('should return false when listener is not found', () => {
      const result = bus.off('non-existent-id');

      expect(result).toBe(false);
    });
  });

  describe('removeAllListeners()', () => {
    it('should remove all listeners for a specific event', async () => {
      const listener1 = vi.fn();
      const listener2 = vi.fn();

      bus.on('session_start', listener1);
      bus.on('session_start', listener2);

      bus.removeAllListeners('session_start');
      await bus.emit('session_start', {});

      expect(listener1).not.toHaveBeenCalled();
      expect(listener2).not.toHaveBeenCalled();
    });

    it('should remove all listeners when no event specified', async () => {
      const listener1 = vi.fn();
      const listener2 = vi.fn();

      bus.on('session_start', listener1);
      bus.on('session_end', listener2);

      bus.removeAllListeners();
      await bus.emit('session_start', {});
      await bus.emit('session_end', {});

      expect(listener1).not.toHaveBeenCalled();
      expect(listener2).not.toHaveBeenCalled();
    });
  });

  describe('wildcard listeners', () => {
    it('should call wildcard listeners for any event', async () => {
      const listener = vi.fn();
      bus.on('*', listener);

      await bus.emit('session_start', {});
      await bus.emit('session_end', {});

      expect(listener).toHaveBeenCalledTimes(2);
      expect(listener).toHaveBeenCalledWith('session_start', {});
      expect(listener).toHaveBeenCalledWith('session_end', {});
    });

    it('should call both specific and wildcard listeners', async () => {
      const specificListener = vi.fn();
      const wildcardListener = vi.fn();

      bus.on('session_start', specificListener);
      bus.on('*', wildcardListener);

      await bus.emit('session_start', {});

      expect(specificListener).toHaveBeenCalledTimes(1);
      expect(wildcardListener).toHaveBeenCalledTimes(1);
    });

    it('should respect priority between specific and wildcard listeners', async () => {
      const callOrder: string[] = [];

      bus.on('session_start', async () => { callOrder.push('specific-low'); }, { priority: 1 });
      bus.on('*', async () => { callOrder.push('wildcard-high'); }, { priority: 10 });
      bus.on('session_start', async () => { callOrder.push('specific-high'); }, { priority: 5 });

      await bus.emit('session_start', {});

      expect(callOrder).toEqual(['wildcard-high', 'specific-high', 'specific-low']);
    });
  });

  describe('emitSync()', () => {
    it('should emit event without waiting', () => {
      const listener = vi.fn();
      bus.on('session_start', listener);

      bus.emitSync('session_start', {});

      // Should not have been called yet (async)
      expect(listener).not.toHaveBeenCalled();
    });
  });

  describe('listenerCount()', () => {
    it('should return the number of listeners for an event', () => {
      bus.on('session_start', vi.fn());
      bus.on('session_start', vi.fn());
      bus.on('session_end', vi.fn());

      expect(bus.listenerCount('session_start')).toBe(2);
      expect(bus.listenerCount('session_end')).toBe(1);
      expect(bus.listenerCount('before_agent')).toBe(0);
    });

    it('should count wildcard listeners separately', () => {
      bus.on('*', vi.fn());
      bus.on('*', vi.fn());
      bus.on('session_start', vi.fn());

      expect(bus.listenerCount('*')).toBe(2);
      expect(bus.listenerCount('session_start')).toBe(1);
    });
  });

  describe('getEvents()', () => {
    it('should return all events with listeners', () => {
      bus.on('session_start', vi.fn());
      bus.on('session_end', vi.fn());
      bus.on('before_agent', vi.fn());

      const events = bus.getEvents();

      expect(events).toContain('session_start');
      expect(events).toContain('session_end');
      expect(events).toContain('before_agent');
      expect(events).toHaveLength(3);
    });

    it('should include wildcard in events list', () => {
      bus.on('*', vi.fn());
      bus.on('session_start', vi.fn());

      const events = bus.getEvents();

      expect(events).toContain('*');
      expect(events).toContain('session_start');
    });
  });

  describe('event history', () => {
    it('should track emitted events', async () => {
      await bus.emit('session_start', { id: '1' });
      await bus.emit('session_end', { id: '2' });

      const history = bus.getHistory();

      expect(history).toHaveLength(2);
      expect(history[0].event).toBe('session_start');
      expect(history[0].data).toEqual({ id: '1' });
      expect(history[1].event).toBe('session_end');
      expect(history[1].data).toEqual({ id: '2' });
    });

    it('should limit history size', async () => {
      const smallBus = new MessageBus(3);

      await smallBus.emit('session_start', {});
      await smallBus.emit('session_end', {});
      await smallBus.emit('before_agent', {});
      await smallBus.emit('after_agent', {});

      const history = smallBus.getHistory();

      expect(history).toHaveLength(3);
      expect(history[0].event).toBe('session_end');
      expect(history[2].event).toBe('after_agent');
    });

    it('should return limited history', async () => {
      await bus.emit('session_start', {});
      await bus.emit('session_end', {});
      await bus.emit('before_agent', {});

      const history = bus.getHistory(2);

      expect(history).toHaveLength(2);
      expect(history[0].event).toBe('session_end');
      expect(history[1].event).toBe('before_agent');
    });

    it('should clear history', async () => {
      await bus.emit('session_start', {});
      await bus.emit('session_end', {});

      bus.clearHistory();

      expect(bus.getHistory()).toHaveLength(0);
    });

    it('should include timestamp in history', async () => {
      const before = Date.now();
      await bus.emit('session_start', {});
      const after = Date.now();

      const history = bus.getHistory();

      expect(history[0].timestamp).toBeGreaterThanOrEqual(before);
      expect(history[0].timestamp).toBeLessThanOrEqual(after);
    });
  });

  describe('waitFor()', () => {
    it('should resolve when event is emitted', async () => {
      const promise = bus.waitFor('session_start');

      setTimeout(() => {
        bus.emit('session_start', { test: 'data' });
      }, 10);

      const data = await promise;

      expect(data).toEqual({ test: 'data' });
    });

    it('should timeout if event is not emitted', async () => {
      const promise = bus.waitFor('session_start', 50);

      await expect(promise).rejects.toThrow("Timeout waiting for event 'session_start'");
    });

    it('should not timeout if event is emitted in time', async () => {
      const promise = bus.waitFor('session_start', 100);

      setTimeout(() => {
        bus.emit('session_start', { test: 'data' });
      }, 10);

      const data = await promise;

      expect(data).toEqual({ test: 'data' });
    });
  });

  describe('filter()', () => {
    it('should create filtered bus that only receives matching events', async () => {
      const filteredBus = bus.filter((event) => event === 'session_start');
      const listener = vi.fn();

      filteredBus.on('*', listener);

      await bus.emit('session_start', {});
      await bus.emit('session_end', {});

      expect(listener).toHaveBeenCalledTimes(1);
      expect(listener).toHaveBeenCalledWith('session_start', {});
    });

    it('should filter based on data', async () => {
      const filteredBus = bus.filter((event, data) => data.important === true);
      const listener = vi.fn();

      filteredBus.on('*', listener);

      await bus.emit('session_start', { important: true });
      await bus.emit('session_start', { important: false });

      expect(listener).toHaveBeenCalledTimes(1);
    });
  });

  describe('global message bus', () => {
    beforeEach(() => {
      resetMessageBus();
    });

    it('should return singleton instance', () => {
      const bus1 = getMessageBus();
      const bus2 = getMessageBus();

      expect(bus1).toBe(bus2);
    });

    it('should allow setting custom bus', () => {
      const customBus = new MessageBus();
      setMessageBus(customBus);

      const bus = getMessageBus();

      expect(bus).toBe(customBus);
    });

    it('should reset to undefined', () => {
      getMessageBus(); // Create instance
      resetMessageBus();

      // Next call should create new instance
      const bus1 = getMessageBus();
      resetMessageBus();
      const bus2 = getMessageBus();

      expect(bus1).not.toBe(bus2);
    });
  });
});
