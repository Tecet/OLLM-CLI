/**
 * API Key Input Dialog
 * 
 * Prompts users to enter API keys required by MCP servers during installation.
 * Provides links to get API keys from provider websites.
 */

import React, { useState, useCallback } from 'react';
import { Box, Text, useInput } from 'ink';

import { createLogger } from '../../../../../core/src/utils/logger.js';

import type { MCPMarketplaceServer } from '../../../services/mcpMarketplace.js';

const logger = createLogger('APIKeyInputDialog');

export interface APIKeyInputDialogProps {
  /** Server being installed */
  server: MCPMarketplaceServer;
  /** Callback when user confirms installation */
  onInstall: (envVars: Record<string, string>) => Promise<void>;
  /** Callback when user cancels */
  onCancel: () => void;
}

interface EnvVarField {
  name: string;
  value: string;
  description?: string;
  required: boolean;
  getKeyUrl?: string;
}

/**
 * Extract API key URL from server description
 * Looks for patterns like "Visit https://..." or "Get your key at https://..."
 */
function extractAPIKeyURL(description: string): string | null {
  const urlMatch = description.match(/(?:Visit|Get.*at|available at)\s+(https?:\/\/[^\s,]+)/i);
  return urlMatch ? urlMatch[1] : null;
}

/**
 * API Key Input Dialog Component
 */
export function APIKeyInputDialog({ server, onInstall, onCancel }: APIKeyInputDialogProps) {
  // Build list of environment variables from server config
  const envVarFields: EnvVarField[] = Object.entries(server.env || {}).map(([name, defaultValue]) => {
    // Determine if required based on requirements list
    const isRequired = server.requirements?.some(req => 
      req.toLowerCase().includes('api key') || 
      req.toLowerCase().includes(name.toLowerCase())
    ) || false;
    
    // Try to extract API key URL from description
    const apiKeyUrl = server.description ? extractAPIKeyURL(server.description) : null;
    
    return {
      name,
      value: defaultValue || '',
      description: `${name} for ${server.name}`,
      required: isRequired,
      getKeyUrl: apiKeyUrl || server.homepage,
    };
  });

  const [fields, setFields] = useState<EnvVarField[]>(envVarFields);
  const [selectedFieldIndex, setSelectedFieldIndex] = useState(0);
  const [isEditing, setIsEditing] = useState(false);
  const [isInstalling, setIsInstalling] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Navigation items: fields + action buttons
  const totalItems = fields.length + 2; // fields + [Skip] + [Install]
  const skipButtonIndex = fields.length;
  const installButtonIndex = fields.length + 1;

  /**
   * Handle keyboard input
   */
  useInput((input, key) => {
    if (isInstalling) return;

    // Editing mode
    if (isEditing) {
      if (key.return) {
        setIsEditing(false);
      } else if (key.escape) {
        // Cancel editing, revert to original value
        setIsEditing(false);
      } else if (key.backspace || key.delete) {
        // Remove last character
        setFields(prev => {
          const updated = [...prev];
          updated[selectedFieldIndex].value = updated[selectedFieldIndex].value.slice(0, -1);
          return updated;
        });
      } else if (input && !key.ctrl && !key.meta) {
        // Add character
        setFields(prev => {
          const updated = [...prev];
          updated[selectedFieldIndex].value += input;
          return updated;
        });
      }
      return;
    }

    // Navigation mode
    if (key.upArrow) {
      setSelectedFieldIndex(prev => Math.max(0, prev - 1));
    } else if (key.downArrow) {
      setSelectedFieldIndex(prev => Math.min(totalItems - 1, prev + 1));
    } else if (key.return) {
      if (selectedFieldIndex < fields.length) {
        // Edit field
        setIsEditing(true);
      } else if (selectedFieldIndex === skipButtonIndex) {
        // Skip - install without keys
        handleSkip();
      } else if (selectedFieldIndex === installButtonIndex) {
        // Install with keys
        handleInstall();
      }
    } else if (key.escape) {
      onCancel();
    } else if (input === 'g' || input === 'G') {
      // Open "Get API Key" link for current field
      if (selectedFieldIndex < fields.length) {
        const field = fields[selectedFieldIndex];
        if (field.getKeyUrl) {
          // In a real implementation, this would open the browser
          // For now, just show the URL
          logger.info(`Open browser: ${field.getKeyUrl}`);
        }
      }
    }
  });

  /**
   * Handle skip - install without API keys
   */
  const handleSkip = useCallback(async () => {
    setIsInstalling(true);
    try {
      await onInstall({});
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Installation failed');
      setIsInstalling(false);
    }
  }, [onInstall]);

  /**
   * Handle install with API keys
   */
  const handleInstall = useCallback(async () => {
    // Validate required fields
    const missingRequired = fields.filter(f => f.required && !f.value.trim());
    if (missingRequired.length > 0) {
      setError(`Required: ${missingRequired.map(f => f.name).join(', ')}`);
      return;
    }

    setIsInstalling(true);
    setError(null);

    try {
      // Build env vars object
      const envVars: Record<string, string> = {};
      for (const field of fields) {
        if (field.value.trim()) {
          envVars[field.name] = field.value.trim();
        }
      }

      await onInstall(envVars);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Installation failed');
      setIsInstalling(false);
    }
  }, [fields, onInstall]);

  return (
    <Box
      flexDirection="column"
      borderStyle="round"
      borderColor="cyan"
      paddingX={2}
      paddingY={1}
      width={70}
    >
      {/* Header */}
      <Box justifyContent="center" marginBottom={1}>
        <Text bold color="cyan">
          Configure API Keys - {server.name}
        </Text>
      </Box>

      {/* Description */}
      <Box marginBottom={1}>
        <Text wrap="wrap">
          This server requires API keys to function properly.
        </Text>
      </Box>

      {/* Environment variable fields */}
      {fields.map((field, index) => {
        const isSelected = selectedFieldIndex === index && !isInstalling;
        const isCurrentlyEditing = isEditing && selectedFieldIndex === index;

        return (
          <Box key={field.name} flexDirection="column" marginBottom={1}>
            <Text bold color={field.required ? 'yellow' : 'white'}>
              {field.name} {field.required && '(Required)'}
            </Text>
            
            <Box
              borderStyle="single"
              borderColor={isSelected ? 'cyan' : 'gray'}
              paddingX={1}
              width="100%"
            >
              <Text>
                {field.value ? '•'.repeat(Math.min(field.value.length, 40)) : ''}
                {isCurrentlyEditing && <Text color="cyan">_</Text>}
              </Text>
            </Box>

            {field.getKeyUrl && (
              <Box marginTop={0}>
                <Text dimColor>
                  Get key: {field.getKeyUrl}
                </Text>
              </Box>
            )}
          </Box>
        );
      })}

      {/* Links */}
      {server.repository && (
        <Box marginTop={1} marginBottom={1}>
          <Text dimColor>
            📦 GitHub: {server.repository}
          </Text>
        </Box>
      )}

      {server.homepage && server.homepage !== server.repository && (
        <Box marginBottom={1}>
          <Text dimColor>
            🌐 Homepage: {server.homepage}
          </Text>
        </Box>
      )}

      {/* Warning */}
      <Box
        borderStyle="single"
        borderColor="yellow"
        paddingX={1}
        marginTop={1}
        marginBottom={1}
      >
        <Text color="yellow">
          ⚠️  Keys are stored in plain text in ~/.ollm/settings/mcp.json
        </Text>
      </Box>

      {/* Error message */}
      {error && (
        <Box marginBottom={1}>
          <Text color="red">✗ {error}</Text>
        </Box>
      )}

      {/* Action buttons */}
      <Box justifyContent="space-around" marginTop={1}>
        <Text
          bold={selectedFieldIndex === skipButtonIndex && !isInstalling}
          color={selectedFieldIndex === skipButtonIndex ? 'yellow' : 'gray'}
        >
          {selectedFieldIndex === skipButtonIndex ? '▶ ' : '  '}[S] Skip
        </Text>

        <Text
          bold={selectedFieldIndex === installButtonIndex && !isInstalling}
          color={selectedFieldIndex === installButtonIndex ? 'yellow' : 'green'}
        >
          {selectedFieldIndex === installButtonIndex ? '▶ ' : '  '}[I] Install
        </Text>
      </Box>

      {/* Help text */}
      <Box justifyContent="center" marginTop={1}>
        <Text dimColor>
          {isEditing
            ? 'Type to edit | Enter: Done | Esc: Cancel'
            : isInstalling
            ? 'Installing...'
            : '↑↓: Navigate | Enter: Edit/Select | G: Get Key | Esc: Cancel'}
        </Text>
      </Box>
    </Box>
  );
}
