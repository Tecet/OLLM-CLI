import type { Message } from './ChatContext.js';
import type { LLMProfile, ContextProfile } from '../../config/types.js';

type GPUInfoLike = {
  vramTotal?: number;
  total?: number;
  count?: number;
  model?: string;
  vendor?: string;
};

export interface ContextSizeOption {
  value: number;
  label: string;
  vramEstimate: string;
}

// Fallback options if no profile found
export const DEFAULT_CONTEXT_OPTIONS = [
  { label: '2k', value: 2048 },
  { label: '4k', value: 4096 },
  { label: '8k', value: 8192 },
  { label: '16k', value: 16384 },
  { label: '32k', value: 32768 },
];

/**
 * Heuristic VRAM estimation (fallback)
 */
export function estimateVRAM(paramCountB: number, contextTokens: number): string {
  // Rough estimate: Model weights (fp16 = 2 bytes per param)
  // This is a backup if profile is missing
  const modelGB = paramCountB * 2;
  const kvCacheGB = (contextTokens / 1024) * (paramCountB * 0.1);
  const total = modelGB + kvCacheGB;
  return `${total.toFixed(1)} GB`;
}

// Kept for backward compatibility if needed, but updated to just map to defaults
export const CONTEXT_OPTIONS: ContextSizeOption[] = DEFAULT_CONTEXT_OPTIONS.map((opt) => ({
  ...opt,
  vramEstimate: '',
}));

export function createWelcomeMessage(
  model: string,
  currentContextSize: number,
  profile?: LLMProfile,
  gpuInfo?: GPUInfoLike
): Message {
  let vramUsage = 'Unknown';
  let contextTableRows: string[] = [];

  // Calculate max safe context if VRAM info is available
  // Handle various shapes of gpuInfo (Live object uses vramTotal in bytes, Persisted uses total in GB)
  let gpuTotalGB = 0;
  if (gpuInfo) {
    if (typeof gpuInfo.vramTotal === 'number' && gpuInfo.vramTotal > 0) {
      // Live object typically has vramTotal in bytes, convert to GB
      gpuTotalGB = gpuInfo.vramTotal / (1024 * 1024 * 1024);
    } else if (typeof gpuInfo.total === 'number' && gpuInfo.total > 0) {
      // Persisted fallback object uses total in GB
      gpuTotalGB = gpuInfo.total;
    }
  }

  if (profile) {
    // Exact match from profile
    const currentProfileCtx = profile.context_profiles.find(
      (p: ContextProfile) => p.size === currentContextSize
    );
    if (currentProfileCtx) {
      vramUsage =
        typeof currentProfileCtx.vram_estimate_gb === 'number'
          ? `${currentProfileCtx.vram_estimate_gb.toFixed(1)} GB`
          : currentProfileCtx.vram_estimate || 'Estimating...';
    } else {
      vramUsage = 'Estimating...';
    }

    contextTableRows = profile.context_profiles.map((opt: ContextProfile) => {
      const sizeLabel =
        opt.size_label || (opt.size >= 1024 ? `${opt.size / 1024}k` : `${opt.size}`);
      const vramStr =
        typeof opt.vram_estimate_gb === 'number'
          ? `${opt.vram_estimate_gb.toFixed(1)} GB`
          : opt.vram_estimate || '';
      const row = `| ${sizeLabel.padEnd(5)} | ${vramStr.padEnd(10)} |`;
      return row;
    });
  } else {
    // Fallback heuristic
    const est = estimateVRAM(7, currentContextSize);
    vramUsage = est;

    contextTableRows = DEFAULT_CONTEXT_OPTIONS.map((opt) => {
      const estVram = estimateVRAM(7, opt.value);
      return `| ${opt.label.padEnd(5)} | ${estVram.padEnd(10)} |`;
    });
  }

  const optionsTable = contextTableRows.join('\n');
  const abilities = profile?.abilities ? `**Abilities:** ${profile.abilities.join(', ')}\n` : '';
  const desc = profile?.description ? `*${profile.description}*\n` : '';
  const toolsInfo = profile?.tool_support ? '🛠️ **Tool Support:** Enabled\n' : '';

  // Hardware Info Construction
  const gpuCount = gpuInfo?.count || 1;
  const gpuName = gpuInfo?.model || gpuInfo?.vendor || 'Unknown GPU';
  const vramDisplay = gpuTotalGB > 0 ? `${gpuTotalGB.toFixed(1)} GB` : 'Unknown';

  let gpuListString = '';
  if (gpuCount > 1) {
    const lines = [];
    for (let i = 1; i <= gpuCount; i++) {
      lines.push(`${i} - GPU Type - ${gpuName}`);
    }
    gpuListString = lines.join('\n');
  } else {
    gpuListString = `GPU Type - ${gpuName}`;
  }

  const descriptionLines = [desc, abilities, toolsInfo].map((s) => s.trim()).filter(Boolean);

  const descriptionPart =
    descriptionLines.length > 0 ? `Description:\n${descriptionLines.join('\n')}\n\n` : '';

  const content = `**Current Configuration:**

Hardware:
GPU Found - ${gpuCount}
${gpuListString}
VRAM available - ${vramDisplay}

LLM Model: **${profile ? profile.name : model}**
Context: **${currentContextSize}** tokens (~${vramUsage})

${descriptionPart}**Context Size Options & VRAM Requirements:**

| Size  | VRAM       |
|-------|------------|
${optionsTable}

*Use the interactive menu below to select options.*
type /help for more options`.trim();

  return {
    id: `msg-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
    role: 'system',
    content,
    timestamp: new Date(),
  };
}

export function createCompactWelcomeMessage(model: string, profile?: LLMProfile): Message {
  const name = profile ? profile.name : model;
  const abilities = profile?.abilities ? `Abilities: ${profile.abilities.join(', ')}` : '';
  const toolsInfo = profile?.tool_support ? 'Tools: Enabled' : 'Tools: Disabled';
  const desc = profile?.description ? ` - ${profile.description}` : '';
  const content = `Model loaded: ${name}${desc}\n${toolsInfo}${abilities ? ` | ${abilities}` : ''}`;

  return {
    id: `msg-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
    role: 'system',
    content,
    timestamp: new Date(),
  };
}
