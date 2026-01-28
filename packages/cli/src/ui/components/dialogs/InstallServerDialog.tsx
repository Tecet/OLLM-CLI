/**
 * InstallServerDialog - Dialog for installing MCP servers from marketplace
 *
 * Features:
 * - Display server name, description, rating, install count
 * - Display requirements list
 * - Dynamic configuration form based on server requirements
 * - Environment variables inputs (API keys, etc.)
 * - Auto-approve all tools checkbox
 * - Install and Cancel buttons
 * - Validate required fields before installation
 *
 * Validates: Requirements 4.1-4.7
 */

import React, { useState, useCallback } from 'react';
import { Box, Text } from 'ink';

import { Dialog } from './Dialog.js';
import { Button, ButtonGroup } from '../forms/Button.js';
import { Checkbox } from '../forms/Checkbox.js';
import { FormField } from '../forms/FormField.js';
import { TextInput, validators } from '../forms/TextInput.js';
import { ProgressIndicator } from '../mcp/ProgressIndicator.js';

import type { MCPMarketplaceServer } from '../../../services/mcpMarketplace.js';
import type { MCPServerConfig } from '@ollm/ollm-cli-core/mcp/types.js';

export interface InstallServerDialogProps {
  /** Server to install from marketplace */
  server: MCPMarketplaceServer;
  /** Callback when dialog should close */
  onClose: () => void;
  /** Callback when server is installed */
  onInstall: (serverId: string, config: MCPServerConfig) => Promise<void>;
}

/**
 * Environment variable entry
 */
interface EnvVar {
  key: string;
  value: string;
  required: boolean;
}

/**
 * Check if an environment variable key contains sensitive data
 */
function isSecretKey(key: string): boolean {
  const secretPatterns = ['API_KEY', 'TOKEN', 'SECRET', 'PASSWORD', 'PRIVATE_KEY', 'CREDENTIAL'];
  const upperKey = key.toUpperCase();
  return secretPatterns.some((pattern) => upperKey.includes(pattern));
}

/**
 * Extract required environment variables from server requirements
 */
function extractRequiredEnvVars(server: MCPMarketplaceServer): EnvVar[] {
  const envVars: EnvVar[] = [];

  // Add environment variables from server.env
  if (server.env) {
    Object.entries(server.env).forEach(([key, value]) => {
      envVars.push({
        key,
        value: value || '',
        required: true,
      });
    });
  }

  // Parse requirements for additional env vars
  server.requirements.forEach((req) => {
    const lowerReq = req.toLowerCase();

    // Check for API key requirements
    if (lowerReq.includes('api key') && !envVars.some((v) => v.key.includes('API_KEY'))) {
      // Try to extract the service name
      const match = req.match(/(\w+)\s+api\s+key/i);
      const serviceName = match ? match[1].toUpperCase() : 'API';
      envVars.push({
        key: `${serviceName}_API_KEY`,
        value: '',
        required: true,
      });
    }

    // Check for token requirements
    if (
      lowerReq.includes('token') &&
      !lowerReq.includes('api') &&
      !envVars.some((v) => v.key.includes('TOKEN'))
    ) {
      const match = req.match(/(\w+)\s+.*token/i);
      const serviceName = match ? match[1].toUpperCase() : 'ACCESS';
      envVars.push({
        key: `${serviceName}_TOKEN`,
        value: '',
        required: true,
      });
    }

    // Check for connection string requirements
    if (
      lowerReq.includes('connection string') &&
      !envVars.some((v) => v.key.includes('CONNECTION'))
    ) {
      const match = req.match(/(\w+)\s+connection\s+string/i);
      const serviceName = match ? match[1].toUpperCase() : 'DATABASE';
      envVars.push({
        key: `${serviceName}_CONNECTION_STRING`,
        value: '',
        required: true,
      });
    }
  });

  return envVars;
}

/**
 * Format rating as stars
 */
function formatRating(rating: number): string {
  const fullStars = Math.floor(rating);
  const hasHalfStar = rating % 1 >= 0.5;
  const emptyStars = 5 - fullStars - (hasHalfStar ? 1 : 0);

  return '★'.repeat(fullStars) + (hasHalfStar ? '½' : '') + '☆'.repeat(emptyStars);
}

/**
 * Format install count with K/M suffix
 */
function formatInstallCount(count: number): string {
  if (count >= 1000000) {
    return `${(count / 1000000).toFixed(1)}M`;
  }
  if (count >= 1000) {
    return `${(count / 1000).toFixed(1)}K`;
  }
  return count.toString();
}

/**
 * InstallServerDialog component
 *
 * Provides a comprehensive interface for installing MCP servers:
 * - Server information display
 * - Requirements checklist
 * - Dynamic configuration form
 * - Environment variables with secret masking
 * - Auto-approve tools option
 * - Installation validation
 */
export function InstallServerDialog({ server, onClose, onInstall }: InstallServerDialogProps) {
  // Extract required environment variables from server
  const requiredEnvVars = extractRequiredEnvVars(server);

  // Initialize form state
  const [envVars, setEnvVars] = useState<EnvVar[]>(requiredEnvVars);
  const [autoApproveAll, setAutoApproveAll] = useState(false);
  const [customArgs, setCustomArgs] = useState(server.args?.join(' ') || '');
  const [customCwd, setCustomCwd] = useState('');

  // UI state
  const [isInstalling, setIsInstalling] = useState(false);
  const [validationErrors, setValidationErrors] = useState<Record<string, string>>({});
  const [installResult, setInstallResult] = useState<{ success: boolean; message: string } | null>(
    null
  );

  /**
   * Validate form fields
   */
  const validateForm = useCallback((): boolean => {
    const errors: Record<string, string> = {};

    // Validate required environment variables
    envVars.forEach((envVar, index) => {
      if (envVar.required && !envVar.value.trim()) {
        errors[`env_${index}`] = `${envVar.key} is required`;
      }
    });

    setValidationErrors(errors);
    return Object.keys(errors).length === 0;
  }, [envVars]);

  /**
   * Update an environment variable
   */
  const handleUpdateEnvVar = useCallback((index: number, value: string) => {
    setEnvVars((prev) => {
      const updated = [...prev];
      updated[index] = { ...updated[index], value };
      return updated;
    });
  }, []);

  /**
   * Add a custom environment variable
   */
  const handleAddEnvVar = useCallback(() => {
    setEnvVars((prev) => [...prev, { key: '', value: '', required: false }]);
  }, []);

  /**
   * Remove a custom environment variable
   */
  const handleRemoveEnvVar = useCallback((index: number) => {
    setEnvVars((prev) => prev.filter((_, i) => i !== index));
  }, []);

  /**
   * Install the server
   */
  const handleInstall = useCallback(async () => {
    if (!validateForm()) {
      setInstallResult({
        success: false,
        message: 'Please fill in all required fields',
      });
      return;
    }

    setIsInstalling(true);
    setInstallResult(null);

    try {
      // Build config object
      const config: MCPServerConfig = {
        command: server.command,
        args: customArgs.split(' ').filter((arg) => arg.trim()) || server.args || [],
        env: envVars.reduce(
          (acc, { key, value }) => {
            if (key.trim() && value.trim()) {
              acc[key] = value;
            }
            return acc;
          },
          {} as Record<string, string>
        ),
        cwd: customCwd || undefined,
        autoApprove: autoApproveAll ? ['*'] : [],
        transport: 'stdio',
      };

      await onInstall(server.id, config);

      setInstallResult({
        success: true,
        message: `Successfully installed ${server.name}`,
      });

      // Close dialog after short delay
      setTimeout(() => {
        onClose();
      }, 1500);
    } catch (error) {
      setInstallResult({
        success: false,
        message: error instanceof Error ? error.message : 'Failed to install server',
      });
    } finally {
      setIsInstalling(false);
    }
  }, [server, envVars, customArgs, customCwd, autoApproveAll, onInstall, onClose, validateForm]);

  return (
    <Dialog title="Install MCP Server" onClose={onClose} width={80}>
      <Box flexDirection="column" paddingX={1}>
        {/* Server Information */}
        <Box flexDirection="column" marginBottom={1}>
          <Text bold color="yellow">
            {server.name}
          </Text>
          <Text dimColor>{server.description}</Text>

          <Box marginTop={1}>
            <Text>Rating: </Text>
            <Text color="yellow">{formatRating(server.rating)}</Text>
            <Text> ({server.rating.toFixed(1)})</Text>
            <Text> | </Text>
            <Text>{formatInstallCount(server.installCount)} installs</Text>
          </Box>

          {server.category && (
            <Box marginTop={1}>
              <Text>Category: </Text>
              <Text color="cyan">{server.category}</Text>
            </Box>
          )}

          {server.author && (
            <Box>
              <Text>Author: </Text>
              <Text dimColor>{server.author}</Text>
            </Box>
          )}
        </Box>

        {/* Requirements */}
        <FormField
          label="Requirements"
          helpText="Ensure these requirements are met before installing"
        >
          <Box flexDirection="column">
            {server.requirements.map((req, index) => (
              <Box key={index}>
                <Text color="gray">• </Text>
                <Text>{req}</Text>
              </Box>
            ))}
          </Box>
        </FormField>

        {/* OAuth Warning */}
        {server.requiresOAuth && (
          <Box marginY={1} borderStyle="single" borderColor="yellow" padding={1}>
            <Text color="yellow">⚠ This server requires OAuth authentication</Text>
            <Text dimColor>You'll need to configure OAuth after installation</Text>
          </Box>
        )}

        {/* Configuration */}
        <FormField label="Configuration" helpText="Server command and arguments">
          <Box flexDirection="column">
            <Box>
              <Text dimColor>Command: </Text>
              <Text>{server.command}</Text>
            </Box>

            <Box marginTop={1}>
              <Text dimColor>Arguments: </Text>
            </Box>
            <Box marginLeft={2}>
              <TextInput
                value={customArgs}
                onChange={setCustomArgs}
                placeholder={server.args?.join(' ') || 'No arguments'}
              />
            </Box>
          </Box>
        </FormField>

        {/* Working Directory */}
        <FormField
          label="Working Directory (Optional)"
          helpText="Custom working directory for the server process"
        >
          <TextInput
            value={customCwd}
            onChange={setCustomCwd}
            placeholder="Leave empty to use default"
          />
        </FormField>

        {/* Environment Variables */}
        {envVars.length > 0 && (
          <FormField
            label="Environment Variables"
            helpText="Required configuration values (API keys, tokens, etc.)"
          >
            <Box flexDirection="column">
              {envVars.map((envVar, index) => (
                <Box key={index} flexDirection="column" marginY={1}>
                  <Box>
                    <Text bold>{envVar.key}</Text>
                    {envVar.required && <Text color="red">*</Text>}
                    {!envVar.required && (
                      <Box marginLeft={2}>
                        <Button
                          label="Remove"
                          onPress={() => handleRemoveEnvVar(index)}
                          variant="danger"
                          icon="✗"
                        />
                      </Box>
                    )}
                  </Box>

                  <Box marginLeft={2}>
                    <TextInput
                      value={envVar.value}
                      onChange={(value) => handleUpdateEnvVar(index, value)}
                      placeholder={`Enter ${envVar.key}`}
                      mask={isSecretKey(envVar.key)}
                      validate={envVar.required ? validators.required : undefined}
                    />
                  </Box>

                  {validationErrors[`env_${index}`] && (
                    <Box marginLeft={2}>
                      <Text color="red">⚠ {validationErrors[`env_${index}`]}</Text>
                    </Box>
                  )}
                </Box>
              ))}

              <Box marginTop={1}>
                <Button
                  label="Add Custom Variable"
                  onPress={handleAddEnvVar}
                  variant="secondary"
                  icon="+"
                />
              </Box>
            </Box>
          </FormField>
        )}

        {/* Auto-Approve Tools */}
        <Box marginY={1}>
          <Checkbox
            label="Auto-approve all tools (not recommended for untrusted servers)"
            checked={autoApproveAll}
            onChange={setAutoApproveAll}
            description="Tools will execute without confirmation. You can configure this later."
          />
        </Box>

        {/* Install Result */}
        {installResult && (
          <Box marginY={1}>
            <Text color={installResult.success ? 'green' : 'red'}>
              {installResult.success ? '✓' : '✗'} {installResult.message}
            </Text>
          </Box>
        )}

        {/* Installation Progress */}
        {isInstalling && (
          <Box marginY={1}>
            <ProgressIndicator
              operation="install"
              serverName={server.name}
              step="Installing server and starting process..."
            />
          </Box>
        )}

        {/* Action Buttons */}
        <Box marginTop={2} gap={2}>
          <ButtonGroup
            buttons={[
              {
                label: 'Install',
                onPress: handleInstall,
                variant: 'primary',
                loading: isInstalling,
                disabled: isInstalling,
                shortcut: 'I',
                icon: '⬇',
              },
              {
                label: 'Cancel',
                onPress: onClose,
                variant: 'secondary',
                disabled: isInstalling,
                shortcut: 'Esc',
              },
            ]}
          />
        </Box>

        {/* Help Text */}
        <Box marginTop={2} flexDirection="column">
          <Text dimColor>💡 Tip: The server will be added to your MCP configuration and</Text>
          <Text dimColor>started automatically after installation.</Text>
        </Box>
      </Box>
    </Dialog>
  );
}
