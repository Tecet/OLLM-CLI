/**
 * ToolSupportMessages - Helper functions for formatting tool support status messages
 * 
 * This module provides utilities for creating consistent system messages
 * related to tool support detection, auto-detection progress, and runtime errors.
 */

/**
 * Format a tool support status message for display
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
 */
export function formatToolErrorDetected(modelName: string, errorMessage: string): string {
  return `⚠️ Tool error detected for "${modelName}": ${errorMessage}`;
}

/**
 * Format a metadata save confirmation message
 */
export function formatMetadataSaved(modelName: string, toolSupport: boolean): string {
  const status = toolSupport ? 'enabled' : 'disabled';
  return `💾 Tool support ${status} for "${modelName}" and saved to user_models.json`;
}

/**
 * Format a session-only override message
 */
export function formatSessionOnlyOverride(modelName: string, toolSupport: boolean): string {
  const status = toolSupport ? 'enabled' : 'disabled';
  return `⏱️ Tool support ${status} for "${modelName}" (session only, not saved)`;
}

/**
 * Format an unknown model prompt message
 */
export function formatUnknownModelPrompt(modelName: string): string {
  return `❓ Unknown model "${modelName}" - tool support status unclear`;
}

/**
 * Format a model switch notification with tool support info
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
 */
export function formatTimeoutWarning(modelName: string, defaultChoice: boolean): string {
  const status = defaultChoice ? 'disabled' : 'enabled';
  return `⏱️ Timeout reached for "${modelName}" - defaulting to tools ${status} (safe default)`;
}

/**
 * Format a user confirmation request message
 */
export function formatUserConfirmationRequest(modelName: string, action: 'save' | 'detect'): string {
  if (action === 'save') {
    return `💾 Save tool support metadata for "${modelName}" to user_models.json?`;
  } else {
    return `🔍 Auto-detect tool support for "${modelName}"?`;
  }
}

/**
 * Add a system message to the chat
 * This is a helper that uses the global callback registered by ChatContext
 */
export function addSystemMessage(message: string): void {
  if (globalThis.__ollmAddSystemMessage) {
    globalThis.__ollmAddSystemMessage(message);
  } else {
    // Fallback: log to console if callback not registered
    console.warn('[ToolSupportMessages] System message callback not registered:', message);
  }
}

/**
 * Add a tool support status message to the chat
 */
export function addToolSupportStatusMessage(
  modelName: string,
  toolSupport: boolean,
  source: 'profile' | 'user_confirmed' | 'auto_detected' | 'runtime_error'
): void {
  const message = formatToolSupportStatus(modelName, toolSupport, source);
  addSystemMessage(message);
}

/**
 * Add an auto-detect progress message to the chat
 */
export function addAutoDetectProgressMessage(
  modelName: string,
  stage: 'starting' | 'testing' | 'success' | 'failure'
): void {
  const message = formatAutoDetectProgress(modelName, stage);
  addSystemMessage(message);
}

/**
 * Add a tool error detection message to the chat
 */
export function addToolErrorMessage(modelName: string, errorMessage: string): void {
  const message = formatToolErrorDetected(modelName, errorMessage);
  addSystemMessage(message);
}

/**
 * Add a metadata saved confirmation message to the chat
 */
export function addMetadataSavedMessage(modelName: string, toolSupport: boolean): void {
  const message = formatMetadataSaved(modelName, toolSupport);
  addSystemMessage(message);
}

/**
 * Add a session-only override message to the chat
 */
export function addSessionOnlyMessage(modelName: string, toolSupport: boolean): void {
  const message = formatSessionOnlyOverride(modelName, toolSupport);
  addSystemMessage(message);
}

/**
 * Add a model switch notification to the chat
 */
export function addModelSwitchMessage(
  fromModel: string,
  toModel: string,
  toolSupportChanged: boolean,
  newToolSupport: boolean
): void {
  const message = formatModelSwitchNotification(fromModel, toModel, toolSupportChanged, newToolSupport);
  addSystemMessage(message);
}
