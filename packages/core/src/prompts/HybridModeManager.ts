/**
 * Hybrid Mode Manager for Dynamic Prompt System
 * 
 * Manages hybrid modes that combine capabilities from multiple modes.
 * Enables complex workflows like secure development or performance-focused development.
 */

import type { ModeType } from './ContextAnalyzer.js';

/**
 * Hybrid mode definition
 */
export interface HybridMode {
  id: string;
  name: string;
  description: string;
  icon: string;
  color: string;
  modes: ModeType[];
  persona: string;
}

/**
 * Preset hybrid modes
 */
export const PRESET_HYBRID_MODES: Record<string, HybridMode> = {
  'secure-developer': {
    id: 'secure-developer',
    name: 'Secure Developer',
    description: 'Development with security-first mindset',
    icon: '🔒👨‍💻',
    color: 'purple',
    modes: ['developer', 'security'],
    persona: 'Senior Software Engineer with Security Expertise'
  },
  
  'perf-developer': {
    id: 'perf-developer',
    name: 'Performance Developer',
    description: 'Development focused on performance optimization',
    icon: '⚡👨‍💻',
    color: 'magenta',
    modes: ['developer', 'performance'],
    persona: 'Senior Software Engineer with Performance Expertise'
  },
  
  'security-debugger': {
    id: 'security-debugger',
    name: 'Security Debugger',
    description: 'Debugging with security vulnerability detection',
    icon: '🔒🐛',
    color: 'red-purple',
    modes: ['debugger', 'security'],
    persona: 'Debugging Specialist with Security Awareness'
  },
  
  'quality-developer': {
    id: 'quality-developer',
    name: 'Quality Developer',
    description: 'Development with continuous code review',
    icon: '👀👨‍💻',
    color: 'orange-green',
    modes: ['developer', 'reviewer'],
    persona: 'Senior Software Engineer with Quality Focus'
  },
  
  'full-stack-developer': {
    id: 'full-stack-developer',
    name: 'Full Stack Developer',
    description: 'Development with security, performance, and quality checks',
    icon: '🚀',
    color: 'rainbow',
    modes: ['developer', 'security', 'performance', 'reviewer'],
    persona: 'Full Stack Engineer with Comprehensive Expertise'
  }
};

/**
 * Hybrid Mode Manager
 * 
 * Manages hybrid modes that combine multiple mode capabilities.
 */
export class HybridModeManager {
  private activeHybridMode: HybridMode | null = null;
  private customHybridModes: Map<string, HybridMode> = new Map();
  
  /**
   * Create a hybrid mode from multiple modes
   */
  createHybridMode(modes: ModeType[], customName?: string): HybridMode {
    // Sort modes for consistent ID generation
    const sortedModes = [...modes].sort();
    const id = `hybrid-${sortedModes.join('-')}`;
    
    // Check if this is a preset hybrid mode
    const preset = Object.values(PRESET_HYBRID_MODES).find(
      hm => this.modesMatch(hm.modes, sortedModes)
    );
    
    if (preset) {
      return preset;
    }
    
    // Create custom hybrid mode
    const hybridMode: HybridMode = {
      id,
      name: customName || this.generateHybridName(modes),
      description: `Hybrid mode combining: ${modes.join(', ')}`,
      icon: this.generateHybridIcon(modes),
      color: this.generateHybridColor(modes),
      modes: sortedModes,
      persona: this.combinePersonas(modes)
    };
    
    // Store custom hybrid mode
    this.customHybridModes.set(id, hybridMode);
    
    return hybridMode;
  }
  
  /**
   * Check if two mode arrays match
   */
  private modesMatch(modes1: ModeType[], modes2: ModeType[]): boolean {
    if (modes1.length !== modes2.length) {
      return false;
    }
    
    const sorted1 = [...modes1].sort();
    const sorted2 = [...modes2].sort();
    
    return sorted1.every((mode, index) => mode === sorted2[index]);
  }
  
  /**
   * Generate a name for a hybrid mode
   */
  private generateHybridName(modes: ModeType[]): string {
    const modeNames: Record<ModeType, string> = {
      assistant: 'Assistant',
      planning: 'Planner',
      developer: 'Developer',
      tool: 'Tool Expert',
      debugger: 'Debugger',
      security: 'Security',
      reviewer: 'Reviewer',
      performance: 'Performance',
      prototype: 'Prototyper',
      teacher: 'Teacher'
    };
    
    return modes.map(m => modeNames[m]).join(' + ');
  }
  
  /**
   * Generate an icon for a hybrid mode
   */
  private generateHybridIcon(modes: ModeType[]): string {
    const modeIcons: Record<ModeType, string> = {
      assistant: '💬',
      planning: '📋',
      developer: '👨‍💻',
      tool: '🔧',
      debugger: '🐛',
      security: '🔒',
      reviewer: '👀',
      performance: '⚡',
      prototype: '🔬',
      teacher: '👨‍🏫'
    };
    
    return modes.map(m => modeIcons[m]).join('');
  }
  
  /**
   * Generate a color for a hybrid mode
   */
  private generateHybridColor(modes: ModeType[]): string {
    const modeColors: Record<ModeType, string> = {
      assistant: 'blue',
      planning: 'yellow',
      developer: 'green',
      tool: 'cyan',
      debugger: 'red',
      security: 'purple',
      reviewer: 'orange',
      performance: 'magenta',
      prototype: 'bright-cyan',
      teacher: 'warm-yellow'
    };
    
    // For multiple modes, combine colors
    if (modes.length === 1) {
      return modeColors[modes[0]];
    } else if (modes.length === 2) {
      return `${modeColors[modes[0]]}-${modeColors[modes[1]]}`;
    } else {
      return 'rainbow';
    }
  }
  
  /**
   * Combine personas from multiple modes
   */
  combinePersonas(modes: ModeType[]): string {
    const modePersonas: Record<ModeType, string> = {
      assistant: 'Helpful AI Assistant',
      planning: 'Technical Architect & Planner',
      developer: 'Senior Software Engineer',
      tool: 'Tool Expert',
      debugger: 'Debugging Specialist',
      security: 'Security Auditor',
      reviewer: 'Code Reviewer',
      performance: 'Performance Engineer',
      prototype: 'Rapid Prototyper',
      teacher: 'Technical Educator'
    };
    
    if (modes.length === 1) {
      return modePersonas[modes[0]];
    }
    
    // Combine personas with "and"
    const personas = modes.map(m => modePersonas[m]);
    
    if (personas.length === 2) {
      return `${personas[0]} and ${personas[1]}`;
    }
    
    // For 3+ modes, use commas and "and"
    const lastPersona = personas[personas.length - 1];
    const otherPersonas = personas.slice(0, -1);
    return `${otherPersonas.join(', ')}, and ${lastPersona}`;
  }
  
  /**
   * Combine tool access from multiple modes
   */
  combineToolAccess(modes: ModeType[], getAllowedToolsFn: (mode: ModeType) => string[]): string[] {
    // Union of all allowed tools from all modes
    const allTools = new Set<string>();
    
    for (const mode of modes) {
      const modeTools = getAllowedToolsFn(mode);
      
      // If any mode allows all tools, the hybrid mode allows all tools
      if (modeTools.includes('*')) {
        return ['*'];
      }
      
      modeTools.forEach(tool => allTools.add(tool));
    }
    
    return Array.from(allTools);
  }
  
  /**
   * Combine prompts from multiple modes
   */
  combinePrompts(modes: ModeType[], getTemplatesFn: (mode: ModeType) => string): string {
    const sections: string[] = [];
    
    // Add header
    sections.push(`# Hybrid Mode: ${this.generateHybridName(modes)}`);
    sections.push(`Persona: ${this.combinePersonas(modes)}`);
    sections.push('');
    
    // Add each mode's template
    for (const mode of modes) {
      const template = getTemplatesFn(mode);
      sections.push(`## ${mode.charAt(0).toUpperCase() + mode.slice(1)} Mode Capabilities`);
      sections.push(template);
      sections.push('');
    }
    
    // Add integration guidance
    sections.push('## Integration Guidance');
    sections.push('You have the combined capabilities of all the above modes.');
    sections.push('Apply the appropriate mindset and tools based on the current task:');
    sections.push('');
    
    for (const mode of modes) {
      const guidance = this.getModeGuidance(mode);
      sections.push(`- **${mode}**: ${guidance}`);
    }
    
    return sections.join('\n');
  }
  
  /**
   * Get guidance for when to use each mode's capabilities
   */
  private getModeGuidance(mode: ModeType): string {
    const guidance: Record<ModeType, string> = {
      assistant: 'For general questions and explanations',
      planning: 'For research and design work',
      developer: 'For implementation and coding',
      tool: 'For enhanced tool usage',
      debugger: 'When analyzing errors and bugs',
      security: 'When considering security implications',
      reviewer: 'When assessing code quality',
      performance: 'When optimizing for speed and efficiency',
      prototype: 'For quick experiments and proofs-of-concept',
      teacher: 'When explaining concepts'
    };
    
    return guidance[mode];
  }
  
  /**
   * Get active hybrid mode
   */
  getActiveHybridMode(): HybridMode | null {
    return this.activeHybridMode;
  }
  
  /**
   * Set active hybrid mode
   */
  setActiveHybridMode(hybridMode: HybridMode | null): void {
    this.activeHybridMode = hybridMode;
  }
  
  /**
   * Check if currently in hybrid mode
   */
  isHybridModeActive(): boolean {
    return this.activeHybridMode !== null;
  }
  
  /**
   * Get all preset hybrid modes
   */
  getPresetHybridModes(): HybridMode[] {
    return Object.values(PRESET_HYBRID_MODES);
  }
  
  /**
   * Get all custom hybrid modes
   */
  getCustomHybridModes(): HybridMode[] {
    return Array.from(this.customHybridModes.values());
  }
  
  /**
   * Get all hybrid modes (preset + custom)
   */
  getAllHybridModes(): HybridMode[] {
    return [
      ...this.getPresetHybridModes(),
      ...this.getCustomHybridModes()
    ];
  }
  
  /**
   * Get hybrid mode by ID
   */
  getHybridModeById(id: string): HybridMode | null {
    // Check presets first
    if (id in PRESET_HYBRID_MODES) {
      return PRESET_HYBRID_MODES[id];
    }
    
    // Check custom modes
    return this.customHybridModes.get(id) || null;
  }
  
  /**
   * Delete a custom hybrid mode
   */
  deleteCustomHybridMode(id: string): boolean {
    return this.customHybridModes.delete(id);
  }
  
  /**
   * Clear all custom hybrid modes
   */
  clearCustomHybridModes(): void {
    this.customHybridModes.clear();
  }
}
