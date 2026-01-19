/**
 * Tests for ToolSupportMessages
 */

import { describe, it, expect } from 'vitest';
import {
  formatToolSupportStatus,
  formatAutoDetectProgress,
  formatToolErrorDetected,
  formatMetadataSaved,
  formatSessionOnlyOverride,
  formatUnknownModelPrompt,
  formatModelSwitchNotification,
  formatTimeoutWarning,
  formatUserConfirmationRequest,
} from '../ToolSupportMessages.js';

describe('ToolSupportMessages', () => {
  // Note: Tests for add* functions removed as those functions were deleted
  // in Step 4. Only pure formatting functions remain.
  describe('formatToolSupportStatus', () => {
    it('should format enabled status from profile', () => {
      const result = formatToolSupportStatus('llama3:latest', true, 'profile');
      expect(result).toBe('🛠️ Tool Support for "llama3:latest": ✅ Enabled (from model profile)');
    });

    it('should format disabled status from user confirmation', () => {
      const result = formatToolSupportStatus('test-model', false, 'user_confirmed');
      expect(result).toBe('🛠️ Tool Support for "test-model": ❌ Disabled (confirmed by user)');
    });

    it('should format enabled status from auto-detection', () => {
      const result = formatToolSupportStatus('unknown-model', true, 'auto_detected');
      expect(result).toBe('🛠️ Tool Support for "unknown-model": ✅ Enabled (auto-detected)');
    });

    it('should format disabled status from runtime error', () => {
      const result = formatToolSupportStatus('broken-model', false, 'runtime_error');
      expect(result).toBe('🛠️ Tool Support for "broken-model": ❌ Disabled (detected from error)');
    });
  });

  describe('formatAutoDetectProgress', () => {
    it('should format starting stage', () => {
      const result = formatAutoDetectProgress('test-model', 'starting');
      expect(result).toBe('🔍 Auto-detecting tool support for "test-model"...');
    });

    it('should format testing stage', () => {
      const result = formatAutoDetectProgress('test-model', 'testing');
      expect(result).toBe('🔍 Testing tool capabilities for "test-model"...');
    });

    it('should format success stage', () => {
      const result = formatAutoDetectProgress('test-model', 'success');
      expect(result).toBe('✅ Auto-detection complete for "test-model": Tools supported');
    });

    it('should format failure stage', () => {
      const result = formatAutoDetectProgress('test-model', 'failure');
      expect(result).toBe('⚠️ Auto-detection complete for "test-model": Tools not supported');
    });
  });

  describe('formatToolErrorDetected', () => {
    it('should format tool error message', () => {
      const result = formatToolErrorDetected('test-model', 'unknown field: tools');
      expect(result).toBe('⚠️ Tool error detected for "test-model": unknown field: tools');
    });
  });

  describe('formatMetadataSaved', () => {
    it('should format enabled metadata save', () => {
      const result = formatMetadataSaved('test-model', true);
      expect(result).toBe('💾 Tool support enabled for "test-model" and saved to user_models.json');
    });

    it('should format disabled metadata save', () => {
      const result = formatMetadataSaved('test-model', false);
      expect(result).toBe('💾 Tool support disabled for "test-model" and saved to user_models.json');
    });
  });

  describe('formatSessionOnlyOverride', () => {
    it('should format session-only enabled', () => {
      const result = formatSessionOnlyOverride('test-model', true);
      expect(result).toBe('⏱️ Tool support enabled for "test-model" (session only, not saved)');
    });

    it('should format session-only disabled', () => {
      const result = formatSessionOnlyOverride('test-model', false);
      expect(result).toBe('⏱️ Tool support disabled for "test-model" (session only, not saved)');
    });
  });

  describe('formatUnknownModelPrompt', () => {
    it('should format unknown model message', () => {
      const result = formatUnknownModelPrompt('mystery-model');
      expect(result).toBe('❓ Unknown model "mystery-model" - tool support status unclear');
    });
  });

  describe('formatModelSwitchNotification', () => {
    it('should format model switch without tool support change', () => {
      const result = formatModelSwitchNotification('model-a', 'model-b', false, true);
      expect(result).toBe('🔄 Model switched: "model-a" → "model-b"');
    });

    it('should format model switch with tool support enabled', () => {
      const result = formatModelSwitchNotification('model-a', 'model-b', true, true);
      expect(result).toBe('🔄 Model switched: "model-a" → "model-b"\n🛠️ Tool support is now enabled');
    });

    it('should format model switch with tool support disabled', () => {
      const result = formatModelSwitchNotification('model-a', 'model-b', true, false);
      expect(result).toBe('🔄 Model switched: "model-a" → "model-b"\n🛠️ Tool support is now disabled');
    });
  });

  describe('formatTimeoutWarning', () => {
    it('should format timeout with disabled default', () => {
      const result = formatTimeoutWarning('test-model', true);
      expect(result).toBe('⏱️ Timeout reached for "test-model" - defaulting to tools disabled (safe default)');
    });

    it('should format timeout with enabled default', () => {
      const result = formatTimeoutWarning('test-model', false);
      expect(result).toBe('⏱️ Timeout reached for "test-model" - defaulting to tools enabled (safe default)');
    });
  });

  describe('formatUserConfirmationRequest', () => {
    it('should format save confirmation request', () => {
      const result = formatUserConfirmationRequest('test-model', 'save');
      expect(result).toBe('💾 Save tool support metadata for "test-model" to user_models.json?');
    });

    it('should format detect confirmation request', () => {
      const result = formatUserConfirmationRequest('test-model', 'detect');
      expect(result).toBe('🔍 Auto-detect tool support for "test-model"?');
    });
  });
});
