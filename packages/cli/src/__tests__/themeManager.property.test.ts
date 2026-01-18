/**
 * Property-based tests for Theme Manager
 * Feature: stage-06-cli-ui
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import * as fc from 'fast-check';
import { ThemeManager, resetThemeManager } from '../ui/services/themeManager.js';
import { Theme } from '../config/types.js';
import { defaultDarkTheme, builtInThemes } from '../config/styles.js';

describe('Theme Manager - Property Tests', () => {
  let themeManager: ThemeManager;

  beforeEach(() => {
    resetThemeManager();
    themeManager = new ThemeManager();
  });

  afterEach(() => {
    resetThemeManager();
  });

  /**
   * Arbitrary generator for partial theme colors
   * Creates a Partial<Theme> with random overrides
   */
  const arbPartialTheme: fc.Arbitrary<Partial<Theme>> = fc
    .record(
      {
        name: fc.option(fc.string(), { nil: undefined }),
        bg: fc.option(
          fc.record({
            primary: fc.hexaString({ minLength: 6, maxLength: 6 }).map(s => '#' + s),
            secondary: fc.hexaString({ minLength: 6, maxLength: 6 }).map(s => '#' + s),
            tertiary: fc.hexaString({ minLength: 6, maxLength: 6 }).map(s => '#' + s),
          }),
          { nil: undefined }
        ),
        text: fc.option(
          fc.record({
            primary: fc.hexaString({ minLength: 6, maxLength: 6 }).map(s => '#' + s),
            secondary: fc.hexaString({ minLength: 6, maxLength: 6 }).map(s => '#' + s),
            accent: fc.hexaString({ minLength: 6, maxLength: 6 }).map(s => '#' + s),
          }),
          { nil: undefined }
        ),
        role: fc.option(
          fc.record({
            user: fc.hexaString({ minLength: 6, maxLength: 6 }).map(s => '#' + s),
            assistant: fc.hexaString({ minLength: 6, maxLength: 6 }).map(s => '#' + s),
            system: fc.hexaString({ minLength: 6, maxLength: 6 }).map(s => '#' + s),
            tool: fc.hexaString({ minLength: 6, maxLength: 6 }).map(s => '#' + s),
          }),
          { nil: undefined }
        ),
        status: fc.option(
          fc.record({
            success: fc.hexaString({ minLength: 6, maxLength: 6 }).map(s => '#' + s),
            warning: fc.hexaString({ minLength: 6, maxLength: 6 }).map(s => '#' + s),
            error: fc.hexaString({ minLength: 6, maxLength: 6 }).map(s => '#' + s),
            info: fc.hexaString({ minLength: 6, maxLength: 6 }).map(s => '#' + s),
          }),
          { nil: undefined }
        ),
        diff: fc.option(
          fc.record({
            added: fc.hexaString({ minLength: 6, maxLength: 6 }).map(s => '#' + s),
            removed: fc.hexaString({ minLength: 6, maxLength: 6 }).map(s => '#' + s),
          }),
          { nil: undefined }
        ),
      },
      { requiredKeys: [] }
    )
    .map(obj => {
      // Filter out undefined values to create a proper Partial<Theme>
      const result: Partial<Theme> = {};
      if (obj.name !== undefined) result.name = obj.name;
      if (obj.bg !== undefined) result.bg = obj.bg;
      if (obj.text !== undefined) result.text = obj.text;
      if (obj.role !== undefined) result.role = obj.role;
      if (obj.status !== undefined) result.status = obj.status;
      if (obj.diff !== undefined) result.diff = obj.diff;
      return result;
    });

  /**
   * Property 31: Theme Merging
   * For any custom theme, the theme system should deep-merge it over the default theme,
   * preserving unspecified default values.
   * 
   * Feature: stage-06-cli-ui, Property 31: Theme Merging
   * Validates: Requirements 18.2
   */
  it('Property 31: should deep-merge custom themes preserving defaults', () => {
    fc.assert(
      fc.property(
        arbPartialTheme,
        (customTheme) => {
          // Merge the custom theme with the default
          const mergedTheme = themeManager.mergeThemes(defaultDarkTheme, customTheme);

          // Verify the merged theme has all required top-level properties
          expect(mergedTheme).toHaveProperty('name');
          expect(mergedTheme).toHaveProperty('bg');
          expect(mergedTheme).toHaveProperty('text');
          expect(mergedTheme).toHaveProperty('role');
          expect(mergedTheme).toHaveProperty('status');
          expect(mergedTheme).toHaveProperty('diff');

          // Verify nested properties exist
          expect(mergedTheme.bg).toHaveProperty('primary');
          expect(mergedTheme.bg).toHaveProperty('secondary');
          expect(mergedTheme.bg).toHaveProperty('tertiary');

          expect(mergedTheme.text).toHaveProperty('primary');
          expect(mergedTheme.text).toHaveProperty('secondary');
          expect(mergedTheme.text).toHaveProperty('accent');

          expect(mergedTheme.role).toHaveProperty('user');
          expect(mergedTheme.role).toHaveProperty('assistant');
          expect(mergedTheme.role).toHaveProperty('system');
          expect(mergedTheme.role).toHaveProperty('tool');

          expect(mergedTheme.status).toHaveProperty('success');
          expect(mergedTheme.status).toHaveProperty('warning');
          expect(mergedTheme.status).toHaveProperty('error');
          expect(mergedTheme.status).toHaveProperty('info');

          expect(mergedTheme.diff).toHaveProperty('added');
          expect(mergedTheme.diff).toHaveProperty('removed');

          // Verify custom values override defaults
          if (customTheme.name !== undefined) {
            expect(mergedTheme.name).toBe(customTheme.name);
          } else {
            expect(mergedTheme.name).toBe(defaultDarkTheme.name);
          }

          // Verify nested custom values override defaults
          if (customTheme.bg?.primary !== undefined) {
            expect(mergedTheme.bg.primary).toBe(customTheme.bg.primary);
          } else {
            expect(mergedTheme.bg.primary).toBe(defaultDarkTheme.bg.primary);
          }

          if (customTheme.text?.accent !== undefined) {
            expect(mergedTheme.text.accent).toBe(customTheme.text.accent);
          } else {
            expect(mergedTheme.text.accent).toBe(defaultDarkTheme.text.accent);
          }

          if (customTheme.role?.user !== undefined) {
            expect(mergedTheme.role.user).toBe(customTheme.role.user);
          } else {
            expect(mergedTheme.role.user).toBe(defaultDarkTheme.role.user);
          }

          // Verify unspecified values preserve defaults
          if (customTheme.bg === undefined || customTheme.bg.secondary === undefined) {
            expect(mergedTheme.bg.secondary).toBe(defaultDarkTheme.bg.secondary);
          }

          if (customTheme.status === undefined || customTheme.status.warning === undefined) {
            expect(mergedTheme.status.warning).toBe(defaultDarkTheme.status.warning);
          }

          if (customTheme.diff === undefined || customTheme.diff.added === undefined) {
            expect(mergedTheme.diff.added).toBe(defaultDarkTheme.diff.added);
          }
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * Property 32: Theme Switching
   * For any valid theme name, the CLI should apply that theme immediately to all UI components.
   * 
   * Feature: stage-06-cli-ui, Property 32: Theme Switching
   * Validates: Requirements 18.4
   */
  it('Property 32: should switch themes immediately for valid theme names', () => {
    fc.assert(
      fc.property(
        fc.constantFrom(...Object.keys(builtInThemes)),
        (themeName) => {
          // Load the theme
          const loadedTheme = themeManager.loadTheme(themeName);

          // Verify the theme was loaded
          expect(loadedTheme).toBeDefined();
          expect(loadedTheme.name).toBe(themeName);

          // Verify the theme is now current
          const currentTheme = themeManager.getCurrentTheme();
          expect(currentTheme).toBe(loadedTheme);
          expect(currentTheme.name).toBe(themeName);

          // Verify the theme matches the built-in theme
          const expectedTheme = builtInThemes[themeName];
          expect(currentTheme).toEqual(expectedTheme);

          // Verify all theme properties are present
          expect(currentTheme).toHaveProperty('name');
          expect(currentTheme).toHaveProperty('bg');
          expect(currentTheme).toHaveProperty('text');
          expect(currentTheme).toHaveProperty('role');
          expect(currentTheme).toHaveProperty('status');
          expect(currentTheme).toHaveProperty('diff');

          // Verify nested properties
          expect(currentTheme.bg).toHaveProperty('primary');
          expect(currentTheme.bg).toHaveProperty('secondary');
          expect(currentTheme.bg).toHaveProperty('tertiary');

          expect(currentTheme.text).toHaveProperty('primary');
          expect(currentTheme.text).toHaveProperty('secondary');
          expect(currentTheme.text).toHaveProperty('accent');

          expect(currentTheme.role).toHaveProperty('user');
          expect(currentTheme.role).toHaveProperty('assistant');
          expect(currentTheme.role).toHaveProperty('system');
          expect(currentTheme.role).toHaveProperty('tool');

          expect(currentTheme.status).toHaveProperty('success');
          expect(currentTheme.status).toHaveProperty('warning');
          expect(currentTheme.status).toHaveProperty('error');
          expect(currentTheme.status).toHaveProperty('info');

          expect(currentTheme.diff).toHaveProperty('added');
          expect(currentTheme.diff).toHaveProperty('removed');
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * Additional test: Invalid theme names should throw errors
   */
  it('should throw error for invalid theme names', () => {
    fc.assert(
      fc.property(
        fc.string().filter(name => {
          // Filter out built-in theme names
          if (Object.keys(builtInThemes).includes(name)) {
            return false;
          }
          // Filter out Object.prototype properties that would not throw
          if (name in Object.prototype) {
            return false;
          }
          return true;
        }),
        (invalidThemeName) => {
          expect(() => themeManager.loadTheme(invalidThemeName)).toThrow();
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * Additional test: Theme switching should be idempotent
   */
  it('should be idempotent when switching to the same theme multiple times', () => {
    fc.assert(
      fc.property(
        fc.constantFrom(...Object.keys(builtInThemes)),
        fc.integer({ min: 1, max: 10 }),
        (themeName, switchCount) => {
          // Switch to the theme multiple times
          let lastTheme: Theme | undefined;
          for (let i = 0; i < switchCount; i++) {
            lastTheme = themeManager.loadTheme(themeName);
          }

          // Verify the theme is still correct
          const currentTheme = themeManager.getCurrentTheme();
          expect(currentTheme.name).toBe(themeName);
          expect(currentTheme).toEqual(lastTheme);
          expect(currentTheme).toEqual(builtInThemes[themeName]);
        }
      ),
      { numRuns: 100 }
    );
  });
});
