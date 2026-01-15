/**
 * Test that all UI test helpers are properly exported from the package
 */

import { describe, it, expect } from 'vitest';
import * as testUtils from '../index.js';

describe('UI Test Helpers Exports', () => {
  it('should export stripAnsi', () => {
    expect(testUtils.stripAnsi).toBeDefined();
    expect(typeof testUtils.stripAnsi).toBe('function');
  });

  it('should export getTextContent', () => {
    expect(testUtils.getTextContent).toBeDefined();
    expect(typeof testUtils.getTextContent).toBe('function');
  });

  it('should export frameContains', () => {
    expect(testUtils.frameContains).toBeDefined();
    expect(typeof testUtils.frameContains).toBe('function');
  });

  it('should export frameMatches', () => {
    expect(testUtils.frameMatches).toBeDefined();
    expect(typeof testUtils.frameMatches).toBe('function');
  });

  it('should export KeyboardInput', () => {
    expect(testUtils.KeyboardInput).toBeDefined();
    expect(typeof testUtils.KeyboardInput).toBe('object');
    expect(testUtils.KeyboardInput.ENTER).toBe('\r');
  });

  it('should export typeText', () => {
    expect(testUtils.typeText).toBeDefined();
    expect(typeof testUtils.typeText).toBe('function');
  });

  it('should export typeAndSubmit', () => {
    expect(testUtils.typeAndSubmit).toBeDefined();
    expect(typeof testUtils.typeAndSubmit).toBe('function');
  });

  it('should export waitForCondition', () => {
    expect(testUtils.waitForCondition).toBeDefined();
    expect(typeof testUtils.waitForCondition).toBe('function');
  });

  it('should export waitForText', () => {
    expect(testUtils.waitForText).toBeDefined();
    expect(typeof testUtils.waitForText).toBe('function');
  });

  it('should export mockTheme', () => {
    expect(testUtils.mockTheme).toBeDefined();
    expect(typeof testUtils.mockTheme).toBe('object');
    expect(testUtils.mockTheme.text).toBeDefined();
    expect(testUtils.mockTheme.bg).toBeDefined();
  });

  it('should export mockKeybinds', () => {
    expect(testUtils.mockKeybinds).toBeDefined();
    expect(typeof testUtils.mockKeybinds).toBe('object');
    expect(testUtils.mockKeybinds.send).toBeDefined();
  });

  it('should export UIAssertions', () => {
    expect(testUtils.UIAssertions).toBeDefined();
    expect(typeof testUtils.UIAssertions).toBe('object');
    expect(testUtils.UIAssertions.assertContains).toBeDefined();
    expect(testUtils.UIAssertions.assertNotContains).toBeDefined();
  });

  it('should export UIPerformance', () => {
    expect(testUtils.UIPerformance).toBeDefined();
    expect(typeof testUtils.UIPerformance).toBe('object');
    expect(testUtils.UIPerformance.measureRenderTime).toBeDefined();
  });

  it('should export UISnapshot', () => {
    expect(testUtils.UISnapshot).toBeDefined();
    expect(typeof testUtils.UISnapshot).toBe('object');
    expect(testUtils.UISnapshot.normalizeFrame).toBeDefined();
  });

  it('should export UIState', () => {
    expect(testUtils.UIState).toBeDefined();
    expect(typeof testUtils.UIState).toBe('object');
    expect(testUtils.UIState.isLoading).toBeDefined();
    expect(testUtils.UIState.hasError).toBeDefined();
  });

  it('should export UITestHelpers', () => {
    expect(testUtils.UITestHelpers).toBeDefined();
    expect(typeof testUtils.UITestHelpers).toBe('object');
  });
});
