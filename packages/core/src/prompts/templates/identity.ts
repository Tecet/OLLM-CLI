import { PromptDefinition } from '../types.js';

export const IDENTITY_PROMPT: PromptDefinition = {
  id: 'core-identity',
  name: 'Core Identity',
  content: `You are {{agentType}}CLI agent specializing in software engineering tasks. Your primary goal is to help users safely and efficiently, adhering strictly to the following instructions and utilizing your available tools.`,
  description: 'Defines the base persona of the agent.',
  source: 'static',
  tags: ['core', 'tier1'],
};
