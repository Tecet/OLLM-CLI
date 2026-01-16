
import type { Message } from './ChatContext.js';
import type { LLMProfile } from '../profiles/ProfileManager.js';

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
export const CONTEXT_OPTIONS: ContextSizeOption[] = DEFAULT_CONTEXT_OPTIONS.map(opt => ({ 
    ...opt, 
    vramEstimate: '' 
}));

import type { VRAMInfo } from '@ollm/core';

export function createWelcomeMessage(model: string, currentContextSize: number, profile?: LLMProfile, gpuInfo?: VRAMInfo | null): Message {
  let vramUsage = 'Unknown';
  let contextTableRows: string[] = [];
  let maxContextSize = 0;
  let recommendedSize = 0;
  
  // Calculate max safe context if VRAM info is available
  // Safety buffer: 1.5GB or 10% which ever is larger for system overhead + display
  const SAFETY_BUFFER_GB = gpuInfo ? Math.max(1.5, gpuInfo.total * 0.1) : 1.5;
  const availableForContextGB = gpuInfo ? (gpuInfo.total - SAFETY_BUFFER_GB) : 0;

  if (profile) {
    // Exact match from profile
    const currentProfileCtx = profile.context_profiles.find(p => p.size === currentContextSize);
    vramUsage = currentProfileCtx ? currentProfileCtx.vram_estimate : 'Estimating...';
    
    // Determine max and recommended
    for (const opt of profile.context_profiles) {
        const vramNum = parseFloat(opt.vram_estimate.replace(' GB', ''));
        if (!isNaN(vramNum) && vramNum <= availableForContextGB) {
            maxContextSize = opt.size;
            recommendedSize = opt.size;
        }
    }

    contextTableRows = profile.context_profiles.map(opt => {
        const sizeLabel = opt.size_label || (opt.size >= 1024 ? `${opt.size/1024}k` : `${opt.size}`);
        let row = `| ${sizeLabel.padEnd(5)} | ${opt.vram_estimate.padEnd(10)} |`;
        
        if (opt.size === recommendedSize) {
           row += " <-- Recommended";
        }
        return row;
    });
  } else {
    // Fallback heuristic
    const est = estimateVRAM(7, currentContextSize);
    vramUsage = est;
    
    contextTableRows = DEFAULT_CONTEXT_OPTIONS.map(opt => {
         const estVram = estimateVRAM(7, opt.value);
         return `| ${opt.label.padEnd(5)} | ${estVram.padEnd(10)} |`;
    });
  }

  const optionsTable = contextTableRows.join('\n');
  const abilities = profile?.abilities ? `**Abilities:** ${profile.abilities.join(', ')}\n` : '';
  const desc = profile?.description ? `*${profile.description}*\n` : '';
  const toolsInfo = profile?.tool_support ? "🛠️ **Tool Support:** Enabled\n" : "";
  
  const systemDetectedMsg = maxContextSize > 0 
      ? `\n**System detected maximum safe context size:** ${Math.floor(maxContextSize/1024)}k (based on ${availableForContextGB.toFixed(1)}GB usable VRAM)\n` 
      : '';

  const content = `
Welcome to OLLM CLI! 

**Current Configuration:**
- Model: **${profile ? profile.name : model}**
- Context: **${currentContextSize}** tokens (~${vramUsage})
${desc}${abilities}${toolsInfo}${systemDetectedMsg}
**Context Size Options & VRAM Requirements:**
| Size  | VRAM       |
|-------|------------|
${optionsTable}

*Use the interactive menu below to select options.*
`.trim();

  return {
    id: `msg-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
    role: 'system',
    content,
    timestamp: new Date(),
  };
}
