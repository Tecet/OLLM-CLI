/**
 * Unit tests for Routing Profiles
 * Feature: stage-07-model-management
 */

import { describe, it, expect } from 'vitest';
import {
  getRoutingProfile,
  listRoutingProfiles,
} from '../routingProfiles.js';

describe('Routing Profiles', () => {
  /**
   * Test that fast, general, code, and creative profiles exist
   * Requirements: 6.1, 6.2, 6.3, 6.4
   */
  describe('Built-in profiles existence', () => {
    it('should have a fast profile', () => {
      const profile = getRoutingProfile('fast');
      expect(profile).toBeDefined();
      expect(profile?.name).toBe('fast');
    });

    it('should have a general profile', () => {
      const profile = getRoutingProfile('general');
      expect(profile).toBeDefined();
      expect(profile?.name).toBe('general');
    });

    it('should have a code profile', () => {
      const profile = getRoutingProfile('code');
      expect(profile).toBeDefined();
      expect(profile?.name).toBe('code');
    });

    it('should have a creative profile', () => {
      const profile = getRoutingProfile('creative');
      expect(profile).toBeDefined();
      expect(profile?.name).toBe('creative');
    });
  });

  /**
   * Test profile metadata and requirements
   * Requirements: 6.1, 6.2, 6.3, 6.4
   */
  describe('Profile metadata', () => {
    it('fast profile should have correct metadata', () => {
      const profile = getRoutingProfile('fast');
      expect(profile).toBeDefined();
      if (profile) {
        expect(profile.description).toBe('Quick responses with smaller models');
        expect(profile.preferredFamilies).toContain('phi');
        expect(profile.preferredFamilies).toContain('gemma');
        expect(profile.minContextWindow).toBe(4096);
        expect(profile.requiredCapabilities).toContain('streaming');
        expect(profile.fallbackProfile).toBe('general');
      }
    });

    it('general profile should have correct metadata', () => {
      const profile = getRoutingProfile('general');
      expect(profile).toBeDefined();
      if (profile) {
        expect(profile.description).toBe('Balanced performance for most tasks');
        expect(profile.preferredFamilies).toContain('llama');
        expect(profile.preferredFamilies).toContain('mistral');
        expect(profile.minContextWindow).toBe(8192);
        expect(profile.requiredCapabilities).toContain('streaming');
        expect(profile.fallbackProfile).toBeUndefined();
      }
    });

    it('code profile should have correct metadata', () => {
      const profile = getRoutingProfile('code');
      expect(profile).toBeDefined();
      if (profile) {
        expect(profile.description).toBe('Optimized for code generation');
        expect(profile.preferredFamilies).toContain('codellama');
        expect(profile.preferredFamilies).toContain('deepseek-coder');
        expect(profile.minContextWindow).toBe(16384);
        expect(profile.requiredCapabilities).toContain('streaming');
        expect(profile.fallbackProfile).toBe('general');
      }
    });

    it('creative profile should have correct metadata', () => {
      const profile = getRoutingProfile('creative');
      expect(profile).toBeDefined();
      if (profile) {
        expect(profile.description).toBe('Creative writing and storytelling');
        expect(profile.preferredFamilies).toContain('llama');
        expect(profile.preferredFamilies).toContain('mistral');
        expect(profile.minContextWindow).toBe(8192);
        expect(profile.requiredCapabilities).toContain('streaming');
        expect(profile.fallbackProfile).toBe('general');
      }
    });
  });

  describe('Profile requirements', () => {
    it('all profiles should have minimum context window requirements', () => {
      const profiles = listRoutingProfiles();
      for (const profile of profiles) {
        expect(profile.minContextWindow).toBeGreaterThan(0);
      }
    });

    it('all profiles should have at least one preferred family', () => {
      const profiles = listRoutingProfiles();
      for (const profile of profiles) {
        expect(profile.preferredFamilies.length).toBeGreaterThan(0);
      }
    });

    it('all profiles should have at least one required capability', () => {
      const profiles = listRoutingProfiles();
      for (const profile of profiles) {
        expect(profile.requiredCapabilities.length).toBeGreaterThan(0);
      }
    });

    it('all profiles should have streaming as a required capability', () => {
      const profiles = listRoutingProfiles();
      for (const profile of profiles) {
        expect(profile.requiredCapabilities).toContain('streaming');
      }
    });
  });

  describe('Profile lookup', () => {
    it('should return null for non-existent profile', () => {
      const profile = getRoutingProfile('non-existent');
      expect(profile).toBeNull();
    });

    it('should list all profiles', () => {
      const profiles = listRoutingProfiles();
      expect(profiles.length).toBe(4);
      expect(profiles.map((p) => p.name)).toContain('fast');
      expect(profiles.map((p) => p.name)).toContain('general');
      expect(profiles.map((p) => p.name)).toContain('code');
      expect(profiles.map((p) => p.name)).toContain('creative');
    });
  });

  describe('Fallback chains', () => {
    it('fast profile should fallback to general', () => {
      const profile = getRoutingProfile('fast');
      expect(profile?.fallbackProfile).toBe('general');
    });

    it('code profile should fallback to general', () => {
      const profile = getRoutingProfile('code');
      expect(profile?.fallbackProfile).toBe('general');
    });

    it('creative profile should fallback to general', () => {
      const profile = getRoutingProfile('creative');
      expect(profile?.fallbackProfile).toBe('general');
    });

    it('general profile should have no fallback', () => {
      const profile = getRoutingProfile('general');
      expect(profile?.fallbackProfile).toBeUndefined();
    });
  });
});
