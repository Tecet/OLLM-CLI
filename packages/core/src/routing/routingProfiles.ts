/**
 * Routing Profiles - Predefined model selection criteria for different task types
 */

export interface RoutingProfile {
  name: string;
  description: string;
  preferredFamilies: string[];
  minContextWindow: number;
  requiredCapabilities: string[];
  fallbackProfile?: string;
}

/**
 * Built-in routing profiles
 */
export const ROUTING_PROFILES: RoutingProfile[] = [
  {
    name: 'fast',
    description: 'Quick responses with smaller models',
    preferredFamilies: ['phi', 'gemma', 'mistral'],
    minContextWindow: 4096,
    requiredCapabilities: ['streaming'],
    fallbackProfile: 'general',
  },
  {
    name: 'general',
    description: 'Balanced performance for most tasks',
    preferredFamilies: ['llama', 'mistral', 'qwen'],
    minContextWindow: 8192,
    requiredCapabilities: ['streaming'],
  },
  {
    name: 'code',
    description: 'Optimized for code generation',
    preferredFamilies: ['codellama', 'deepseek-coder', 'starcoder', 'qwen'],
    minContextWindow: 16384,
    requiredCapabilities: ['streaming'],
    fallbackProfile: 'general',
  },
  {
    name: 'creative',
    description: 'Creative writing and storytelling',
    preferredFamilies: ['llama', 'mistral'],
    minContextWindow: 8192,
    requiredCapabilities: ['streaming'],
    fallbackProfile: 'general',
  },
];

/**
 * Get a routing profile by name
 */
export function getRoutingProfile(name: string): RoutingProfile | null {
  return ROUTING_PROFILES.find((p) => p.name === name) ?? null;
}

/**
 * List all available routing profiles
 */
export function listRoutingProfiles(): RoutingProfile[] {
  return [...ROUTING_PROFILES];
}
