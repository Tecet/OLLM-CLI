/**
 * UserPromptBridge - Registers global callback for user prompts
 * 
 * This component bridges the UserPromptContext to global callbacks
 * so that ModelContext can prompt users without direct dependency.
 */

import { useEffect } from 'react';
import { useUserPrompt } from './UserPromptContext.js';

declare global {
  var __ollmPromptUser: ((message: string, options: string[]) => Promise<string>) | undefined;
}

/**
 * Bridge component that registers the promptUser callback globally
 */
export function UserPromptBridge() {
  const { promptUser } = useUserPrompt();
  
  useEffect(() => {
    globalThis.__ollmPromptUser = async (message: string, options: string[]): Promise<string> => {
      return await promptUser(message, options, 30000, options[options.length - 1]); // 30s timeout, default to last option
    };
    
    return () => {
      globalThis.__ollmPromptUser = undefined;
    };
  }, [promptUser]);
  
  return null;
}
