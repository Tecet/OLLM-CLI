/**
 * JSON Schema for configuration validation
 */

export const configSchema = {
  type: 'object',
  properties: {
    provider: {
      type: 'object',
      properties: {
        default: { type: 'string' },
        ollama: {
          type: 'object',
          properties: {
            host: { type: 'string', format: 'uri' },
            timeout: { type: 'number', minimum: 0 },
          },
          required: ['host', 'timeout'],
        },
        vllm: {
          type: 'object',
          properties: {
            host: { type: 'string', format: 'uri' },
            apiKey: { type: 'string' },
          },
          required: ['host'],
        },
        openaiCompatible: {
          type: 'object',
          properties: {
            host: { type: 'string', format: 'uri' },
            apiKey: { type: 'string' },
          },
          required: ['host'],
        },
      },
      required: ['default'],
    },
    model: {
      type: 'object',
      properties: {
        default: { type: 'string' },
        temperature: { type: 'number', minimum: 0, maximum: 2 },
        maxTokens: { type: 'number', minimum: 1 },
      },
      required: ['default', 'temperature', 'maxTokens'],
    },
    ui: {
      type: 'object',
      properties: {
        layout: { type: 'string', enum: ['hybrid', 'simple'] },
        sidePanel: { type: 'boolean' },
        showGpuStats: { type: 'boolean' },
        showCost: { type: 'boolean' },
        metrics: {
          type: 'object',
          properties: {
            enabled: { type: 'boolean' },
            compactMode: { type: 'boolean' },
            showPromptTokens: { type: 'boolean' },
            showTTFT: { type: 'boolean' },
            showInStatusBar: { type: 'boolean' },
          },
          required: ['enabled', 'compactMode', 'showPromptTokens', 'showTTFT', 'showInStatusBar'],
        },
        reasoning: {
          type: 'object',
          properties: {
            enabled: { type: 'boolean' },
            maxVisibleLines: { type: 'number', minimum: 1 },
            autoCollapseOnComplete: { type: 'boolean' },
          },
          required: ['enabled', 'maxVisibleLines', 'autoCollapseOnComplete'],
        },
      },
      required: ['layout', 'sidePanel', 'showGpuStats', 'showCost', 'metrics', 'reasoning'],
    },
    status: {
      type: 'object',
      properties: {
        pollInterval: { type: 'number', minimum: 1000 },
        highTempThreshold: { type: 'number', minimum: 0 },
        lowVramThreshold: { type: 'number', minimum: 0 },
      },
      required: ['pollInterval', 'highTempThreshold', 'lowVramThreshold'],
    },
    review: {
      type: 'object',
      properties: {
        enabled: { type: 'boolean' },
        inlineThreshold: { type: 'number', minimum: 0 },
      },
      required: ['enabled', 'inlineThreshold'],
    },
    session: {
      type: 'object',
      properties: {
        autoSave: { type: 'boolean' },
        saveInterval: { type: 'number', minimum: 1000 },
      },
      required: ['autoSave', 'saveInterval'],
    },
  },
  required: ['provider', 'model'],
};
