/**
 * Model & Context Profiles Configuration
 *
 * This file defines the built-in profiles for:
 * 1. AI Models (LLMs): Capabilities, VRAM usage, and descriptions.
 * 2. Context Behavior: Strategies for managing context window overflow.
 */

export interface ContextProfile {
  size: number;
  size_label?: string;
  vram_estimate: string;
}

export interface LLMProfile {
  id: string;
  name: string;
  creator: string;
  parameters: string;
  quantization: string;
  description: string;
  abilities: string[];
  tool_support?: boolean;
  reasoning_buffer?: string;
  ollama_url?: string;
  context_window: number;
  context_profiles: ContextProfile[];
}

export interface ContextBehaviorProfile {
  name: string;
  contextWindow: number;
  compressionThreshold: number;
  retentionRatio: number;
  strategy: string;
  summaryPrompt: string;
}

export interface ContextSettings {
  activeProfile: string;
  profiles: Record<string, ContextBehaviorProfile>;
}

export interface ProfilesData {
  context_behavior: ContextSettings;
  models: LLMProfile[];
}

export const profilesData: ProfilesData = {
  context_behavior: {
    activeProfile: 'standard',
    profiles: {
      standard: {
        name: 'Standard (High VRAM)',
        contextWindow: 4096,
        compressionThreshold: 0.68,
        retentionRatio: 0.3,
        strategy: 'summarize',
        summaryPrompt:
          "Concisely summarize the conversation history above that is about to be archived. Focus on the user's technical goals, constraints, and any important code details or decisions made. Ignore the instruction to summarize this text.",
      },
      low_vram: {
        name: 'Low VRAM / Aggressive',
        contextWindow: 2048,
        compressionThreshold: 0.5,
        retentionRatio: 0.2,
        strategy: 'summarize',
        summaryPrompt:
          'Briefly summarize the key points of the conversation above. Focus on technical details.',
      },
    },
  },
  models: [
    {
      id: 'qwen2.5:7b',
      name: 'Qwen2.5 7B',
      creator: 'Alibaba Cloud',
      parameters: '7.6B',
      quantization: '4-bit (estimated)',
      description:
        'A comprehensive 7B parameter model from the Qwen2.5 series, offering a balance of performance and efficiency.',
      abilities: ['General Purpose', 'Coding', 'Math', 'Multilingual'],
      tool_support: true,
      ollama_url: 'https://ollama.com/library/qwen2.5',
      context_window: 131072,
      context_profiles: [
        { size: 4096, size_label: '4k', vram_estimate: '5.5 GB' },
        { size: 8192, size_label: '8k', vram_estimate: '6.0 GB' },
        { size: 16384, size_label: '16k', vram_estimate: '7.0 GB' },
        { size: 32768, size_label: '32k', vram_estimate: '9.0 GB' },
        { size: 65536, size_label: '64k', vram_estimate: '13.5 GB' },
        { size: 131072, size_label: '128k', vram_estimate: '22.5 GB' },
      ],
    },
    {
      id: 'deepseek-r1:7b',
      name: 'DeepSeek R1 7B',
      creator: 'DeepSeek',
      parameters: '7B',
      quantization: '4-bit (estimated)',
      description:
        'A distilled reasoning model based on Qwen2.5-Math-7B, optimized for complex logical tasks.',
      abilities: ['Reasoning', 'Math', 'Logic'],
      tool_support: true,
      reasoning_buffer: 'Variable',
      ollama_url: 'https://ollama.com/library/deepseek-r1',
      context_window: 131072,
      context_profiles: [
        { size: 4096, size_label: '4k', vram_estimate: '5.5 GB' },
        { size: 8192, size_label: '8k', vram_estimate: '6.0 GB' },
        { size: 16384, size_label: '16k', vram_estimate: '7.0 GB' },
        { size: 32768, size_label: '32k', vram_estimate: '9.0 GB' },
        { size: 65536, size_label: '64k', vram_estimate: '13.5 GB' },
        { size: 131072, size_label: '128k', vram_estimate: '22.5 GB' },
      ],
    },
    {
      id: 'phi3:3.8b',
      name: 'Phi-3 Mini',
      creator: 'Microsoft',
      parameters: '3.8B',
      quantization: '4-bit (estimated)',
      description:
        'A lightweight, high-performance model suitable for mobile and edge deployments.',
      abilities: ['Reasoning', 'Coding', 'Mobile Optimized'],
      tool_support: true,
      ollama_url: 'https://ollama.com/library/phi3',
      context_window: 131072,
      context_profiles: [
        { size: 4096, size_label: '4k', vram_estimate: '2.8 GB' },
        { size: 8192, size_label: '8k', vram_estimate: '3.2 GB' },
        { size: 16384, size_label: '16k', vram_estimate: '4.0 GB' },
        { size: 32768, size_label: '32k', vram_estimate: '5.5 GB' },
        { size: 65536, size_label: '64k', vram_estimate: '8.5 GB' },
        { size: 131072, size_label: '128k', vram_estimate: '14.5 GB' },
      ],
    },
    {
      id: 'llama3.2:3b',
      name: 'Llama 3.2 3B',
      creator: 'Meta',
      parameters: '3.2B',
      quantization: '4-bit (estimated)',
      description:
        'A highly efficient 3B model from the Llama 3.2 family, designed for edge devices.',
      abilities: ['General Purpose', 'Fast Inference', 'Edge Optimized'],
      tool_support: true,
      ollama_url: 'https://ollama.com/library/llama3.2',
      context_window: 131072,
      context_profiles: [
        { size: 4096, size_label: '4k', vram_estimate: '2.5 GB' },
        { size: 8192, size_label: '8k', vram_estimate: '2.9 GB' },
        { size: 16384, size_label: '16k', vram_estimate: '3.7 GB' },
        { size: 32768, size_label: '32k', vram_estimate: '5.2 GB' },
        { size: 65536, size_label: '64k', vram_estimate: '8.2 GB' },
        { size: 131072, size_label: '128k', vram_estimate: '14.2 GB' },
      ],
    },
    {
      id: 'qwen3:4b',
      name: 'Qwen3 4B',
      creator: 'Alibaba Cloud',
      parameters: '4B',
      quantization: '4-bit (estimated)',
      description:
        'Next-generation compact model from the Qwen series, delivering superior performance for its size.',
      abilities: ['General Purpose', 'Coding', 'Advanced Reasoning'],
      tool_support: true,
      ollama_url: 'https://ollama.com/library/qwen3',
      context_window: 131072,
      context_profiles: [
        { size: 4096, size_label: '4k', vram_estimate: '3.0 GB' },
        { size: 8192, size_label: '8k', vram_estimate: '3.5 GB' },
        { size: 16384, size_label: '16k', vram_estimate: '4.5 GB' },
        { size: 32768, size_label: '32k', vram_estimate: '6.0 GB' },
        { size: 65536, size_label: '64k', vram_estimate: '9.5 GB' },
        { size: 131072, size_label: '128k', vram_estimate: '16.0 GB' },
      ],
    },
    {
      id: 'deepseek-r1:1.5b',
      name: 'DeepSeek R1 1.5B',
      creator: 'DeepSeek',
      parameters: '1.5B',
      quantization: '4-bit (estimated)',
      description:
        'Ultra-lightweight distilled reasoning model, perfect for extremely low-resource environments.',
      abilities: ['Reasoning', 'Math', 'Efficiency'],
      tool_support: true,
      reasoning_buffer: 'Variable',
      ollama_url: 'https://ollama.com/library/deepseek-r1',
      context_window: 131072,
      context_profiles: [
        { size: 4096, size_label: '4k', vram_estimate: '1.5 GB' },
        { size: 8192, size_label: '8k', vram_estimate: '1.8 GB' },
        { size: 16384, size_label: '16k', vram_estimate: '2.4 GB' },
        { size: 32768, size_label: '32k', vram_estimate: '3.5 GB' },
        { size: 65536, size_label: '64k', vram_estimate: '5.8 GB' },
        { size: 131072, size_label: '128k', vram_estimate: '10.0 GB' },
      ],
    },
    {
      id: 'gemma3:4b',
      name: 'Gemma 3 4B',
      creator: 'Google',
      parameters: '4B',
      quantization: '4-bit (estimated)',
      description:
        "Google's latest open model, optimized for efficiency and performance on consumer hardware.",
      abilities: ['General Purpose', 'Knowledge Retrieval', 'Reasoning'],
      tool_support: true,
      ollama_url: 'https://ollama.com/library/gemma3',
      context_window: 131072,
      context_profiles: [
        { size: 4096, size_label: '4k', vram_estimate: '3.8 GB' },
        { size: 8192, size_label: '8k', vram_estimate: '4.3 GB' },
        { size: 16384, size_label: '16k', vram_estimate: '5.3 GB' },
        { size: 32768, size_label: '32k', vram_estimate: '7.2 GB' },
        { size: 65536, size_label: '64k', vram_estimate: '11.0 GB' },
        { size: 131072, size_label: '128k', vram_estimate: '18.5 GB' },
      ],
    },
    {
      id: 'gemma3:1b',
      name: 'Gemma 3 1B',
      creator: 'Google',
      parameters: '1B',
      quantization: '4-bit (estimated)',
      description:
        'Extremely compact variant of Gemma 3, ideal for simple tasks and rapid prototyping.',
      abilities: ['Fast Inference', 'Text Completion'],
      tool_support: false,
      ollama_url: 'https://ollama.com/library/gemma3',
      context_window: 131072,
      context_profiles: [
        { size: 4096, size_label: '4k', vram_estimate: '1.2 GB' },
        { size: 8192, size_label: '8k', vram_estimate: '1.5 GB' },
        { size: 16384, size_label: '16k', vram_estimate: '2.0 GB' },
        { size: 32768, size_label: '32k', vram_estimate: '3.0 GB' },
        { size: 65536, size_label: '64k', vram_estimate: '5.0 GB' },
        { size: 131072, size_label: '128k', vram_estimate: '9.0 GB' },
      ],
    },
    {
      id: 'qwen3-vl:8b',
      name: 'Qwen3-VL 8B',
      creator: 'Alibaba Cloud',
      parameters: '8B',
      quantization: '4-bit (estimated)',
      description:
        'Vision-Language model from the Qwen3 series, capable of understanding and analyzing images.',
      abilities: ['Visual Recognition', 'Multimodal', 'Reasoning'],
      tool_support: true,
      ollama_url: 'https://ollama.com/library/qwen3-vl',
      context_window: 131072,
      context_profiles: [
        { size: 4096, size_label: '4k', vram_estimate: '6.5 GB' },
        { size: 8192, size_label: '8k', vram_estimate: '7.0 GB' },
        { size: 16384, size_label: '16k', vram_estimate: '8.0 GB' },
        { size: 32768, size_label: '32k', vram_estimate: '10.0 GB' },
        { size: 65536, size_label: '64k', vram_estimate: '15.0 GB' },
        { size: 131072, size_label: '128k', vram_estimate: '26.0 GB' },
      ],
    },
    {
      id: 'deepseek-r1:8b',
      name: 'DeepSeek R1 8B',
      creator: 'DeepSeek',
      parameters: '8B',
      quantization: '4-bit (estimated)',
      description: 'Powerful reasoning model with enhanced capacity for complex problem solving.',
      abilities: ['Advanced Reasoning', 'Coding', 'Math'],
      tool_support: true,
      reasoning_buffer: 'Variable',
      ollama_url: 'https://ollama.com/library/deepseek-r1',
      context_window: 131072,
      context_profiles: [
        { size: 4096, size_label: '4k', vram_estimate: '6.0 GB' },
        { size: 8192, size_label: '8k', vram_estimate: '6.5 GB' },
        { size: 16384, size_label: '16k', vram_estimate: '7.5 GB' },
        { size: 32768, size_label: '32k', vram_estimate: '9.5 GB' },
        { size: 65536, size_label: '64k', vram_estimate: '14.5 GB' },
        { size: 131072, size_label: '128k', vram_estimate: '25.0 GB' },
      ],
    },
  ],
};
