/**
 * ToolSupportMessages - Helper functions for formatting tool support status messages
 * 
 * This module provides utilities for creating consistent system messages
 * related to tool support detection, auto-detection progress, and runtime errors.
 */

/**
 * Format a tool support status message for display
 * @param modelName - The name of the model
 * @param toolSupport - Whether the model supports tools
 * @param source - The source of the tool support information
 * @returns Formatted status message with emoji and source label
 */
export function formatToolSupportStatus(
  modelName: string,
  toolSupport: boolean,
  source: 'profile' | 'user_confirmed' | 'auto_detected' | 'runtime_error'
): string {
  const status = toolSupport ? '✅ Enabled' : '❌ Disabled';
  const sourceLabel = {
    profile: 'from model profile',
    user_confirmed: 'confirmed by user',
    auto_detected: 'auto-detected',
    runtime_error: 'detected from error',
  }[source];

  return `🛠️ Tool Support for "${modelName}": ${status} (${sourceLabel})`;
}

/**
 * Format an auto-detect progress message
 * @param modelName - The name of the model being tested
 * @param stage - The current stage of auto-detection
 * @returns Formatted progress message with appropriate emoji
 */
export function formatAutoDetectProgress(modelName: string, stage: 'starting' | 'testing' | 'success' | 'failure'): string {
  const messages = {
    starting: `🔍 Auto-detecting tool support for "${modelName}"...`,
    testing: `🔍 Testing tool capabilities for "${modelName}"...`,
    success: `✅ Auto-detection complete for "${modelName}": Tools supported`,
    failure: `⚠️ Auto-detection complete for "${modelName}": Tools not supported`,
  };

  return messages[stage];
}

/**
 * Format a tool error detection message
 * @param modelName - The name of the model that encountered an error
 * @param errorMessage - The error message from the provider
 * @returns Formatted error message
 */
export function formatToolErrorDetected(modelName: string, errorMessage: string): string {
  return `⚠️ Tool error detected for "${modelName}": ${errorMessage}`;
}

/**
 * Format a metadata save confirmation message
 * @param modelName - The name of the model
 * @param toolSupport - Whether tool support is enabled
 * @returns Formatted confirmation message
 */
export function formatMetadataSaved(modelName: string, toolSupport: boolean): string {
  const status = toolSupport ? 'enabled' : 'disabled';
  return `💾 Tool support ${status} for "${modelName}" and saved to user_models.json`;
}

/**
 * Format a session-only override message
 * @param modelName - The name of the model
 * @param toolSupport - Whether tool support is enabled
 * @returns Formatted session-only message
 */
export function formatSessionOnlyOverride(modelName: string, toolSupport: boolean): string {
  const status = toolSupport ? 'enabled' : 'disabled';
  return `⏱️ Tool support ${status} for "${modelName}" (session only, not saved)`;
}

/**
 * Format an unknown model prompt message
 * @param modelName - The name of the unknown model
 * @returns Formatted prompt message
 */
export function formatUnknownModelPrompt(modelName: string): string {
  return `❓ Unknown model "${modelName}" - tool support status unclear`;
}

/**
 * Format a model switch notification with tool support info
 * @param fromModel - The previous model name
 * @param toModel - The new model name
 * @param toolSupportChanged - Whether tool support status changed
 * @param newToolSupport - The new tool support status
 * @returns Formatted model switch notification
 */
export function formatModelSwitchNotification(
  fromModel: string,
  toModel: string,
  toolSupportChanged: boolean,
  newToolSupport: boolean
): string {
  const base = `🔄 Model switched: "${fromModel}" → "${toModel}"`;
  
  if (toolSupportChanged) {
    const status = newToolSupport ? 'enabled' : 'disabled';
    return `${base}\n🛠️ Tool support is now ${status}`;
  }
  
  return base;
}

/**
 * Format a timeout warning message
 * @param modelName - The name of the model
 * @param defaultChoice - The default choice applied
 * @returns Formatted timeout warning
 */
export function formatTimeoutWarning(modelName: string, defaultChoice: boolean): string {
  const status = defaultChoice ? 'disabled' : 'enabled';
  return `⏱️ Timeout reached for "${modelName}" - defaulting to tools ${status} (safe default)`;
}

/**
 * Format a user confirmation request message
 * @param modelName - The name of the model
 * @param action - The action being requested ('save' or 'detect')
 * @returns Formatted confirmation request
 */
export function formatUserConfirmationRequest(modelName: string, action: 'save' | 'detect'): string {
  if (action === 'save') {
    return `💾 Save tool support metadata for "${modelName}" to user_models.json?`;
  } else {
    return `🔍 Auto-detect tool support for "${modelName}"?`;
  }
}
