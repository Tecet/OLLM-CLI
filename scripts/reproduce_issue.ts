
import { PromptModeManager, ModeType } from '../packages/core/src/prompts/PromptModeManager.js';
import { PromptRegistry } from '../packages/core/src/prompts/PromptRegistry.js';
import { ContextAnalyzer } from '../packages/core/src/prompts/ContextAnalyzer.js';
import { SystemPromptBuilder } from '../packages/core/src/context/SystemPromptBuilder.js';

// Mock Tool Registry and File System
const mockTools = [
  { name: 'read_file' },
  { name: 'write_file' },
  { name: 'list_directory' }
];

async function reproduce() {
  console.log('--- Starting Reproduction Script ---');

  const promptRegistry = new PromptRegistry();
  const contextAnalyzer = new ContextAnalyzer();
  const systemPromptBuilder = new SystemPromptBuilder(promptRegistry); // Assuming this constructor works

  const modeManager = new PromptModeManager(
    systemPromptBuilder,
    promptRegistry,
    contextAnalyzer
  );

  // 1. Test Mode Switching
  console.log('\n--- Testing Mode Switching ---');
  
  // Initial state should be assistant
  console.log('Initial Mode:', modeManager.getCurrentMode());

  // Try explicit switch to Developer
  console.log('Switching to Developer (Explicit)...');
  modeManager.switchMode('developer', 'explicit', 1.0);
  console.log('Current Mode:', modeManager.getCurrentMode());

  if (modeManager.getCurrentMode() !== 'developer') {
    console.error('FAIL: Explicit switch to developer failed');
  } else {
    console.log('PASS: Explicit switch to developer succeeded');
  }

  // Check allowed tools
  const devTools = modeManager.filterToolsForMode(mockTools, 'developer');
  console.log('Developer Tools:', devTools.map(t => t.name));
  
  // Try switching to Planning (Auto - low confidence)
  console.log('\nSwitching to Planning (Auto, 0.5 confidence)...');
  const contextAnalysisLow = {
      mode: 'planning' as ModeType,
      confidence: 0.5,
      triggers: [],
      metadata: { keywords: [], toolsUsed: [], recentTopics: [], codeBlocksPresent: false, errorMessagesPresent: false }
  };
  
  const shouldSwitchLow = modeManager.shouldSwitchMode('developer', contextAnalysisLow);
  console.log('Should switch (0.5)?', shouldSwitchLow);
  
  if (shouldSwitchLow) {
      modeManager.switchMode('planning', 'auto', 0.5);
  }
  console.log('Current Mode:', modeManager.getCurrentMode());

  // Try switching to Planning (Auto - high confidence)
  console.log('\nSwitching to Planning (Auto, 0.9 confidence)...');
  const contextAnalysisHigh = {
      mode: 'planning' as ModeType,
      confidence: 0.9,
      triggers: [],
      metadata: { keywords: [], toolsUsed: [], recentTopics: [], codeBlocksPresent: false, errorMessagesPresent: false }
  };
  
  // Note: Cooldown might block this. We can't easily mock time here without jest, 
  // but we can check if it returns false and why.
  const shouldSwitchHigh = modeManager.shouldSwitchMode('developer', contextAnalysisHigh);
  console.log('Should switch (0.9)?', shouldSwitchHigh);
  
  if (shouldSwitchHigh) {
      modeManager.switchMode('planning', 'auto', 0.9);
  }
  console.log('Current Mode:', modeManager.getCurrentMode());
  
  // Force switch for File Operation test
  modeManager.forceMode('planning');
  console.log('\n--- Testing File Operations in Planning Mode ---');
  console.log('Forced Mode:', modeManager.getCurrentMode());
  
  const planningTools = modeManager.filterToolsForMode(mockTools, 'planning');
  console.log('Planning Tools (Filtered):', planningTools.map(t => t.name));
  
  if (planningTools.find(t => t.name === 'write_file')) {
      console.error('FAIL: write_file should NOT be in planning tools');
  } else {
      console.log('PASS: write_file correctly filtered out');
  }

  // Test validation Logic directly
  console.log('\nTesting validateToolArgsForPlanningMode...');
  try {
      const result = modeManager.validateToolArgsForPlanningMode('write_file', { path: 'src/test.ts' });
      console.log('Validation Result for write_file:', result);
  } catch (e) {
      console.error('Error validation:', e);
  }

  console.log('\n--- Reproduction Script Complete ---');
}

reproduce().catch(console.error);
