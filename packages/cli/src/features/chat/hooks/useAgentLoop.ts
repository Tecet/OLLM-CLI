/**
 * Agent loop logic - handles multi-turn conversations with tool calls
 * This is extracted from useChatNetwork to keep files focused
 */

import fs from 'fs';

import type { Message, ToolCall } from '../types.js';
import type { ToolCall as CoreToolCall, ContextMessage, ProviderMetrics } from '@ollm/core';

export interface AgentLoopContext {
  // LLM communication
  sendToLLM: any;
  cancelRequest: () => void;
  
  // State
  currentModel: string;
  systemPrompt: string;
  toolSchemas: any[] | undefined;
  
  // Context management
  contextActions: any;
  
  // Message management
  addMessage: (message: Omit<Message, 'id' | 'timestamp'>) => Message;
  updateMessage: (id: string, updates: Partial<Message>) => void;
  
  // Service container
  serviceContainer: any;
  
  // Compression state
  compressionOccurred: boolean;
  compressionRetryCount: number;
  resetCompressionFlags: () => void;
  
  // Refs
  inflightTokenAccumulatorRef: React.MutableRefObject<number>;
  inflightFlushTimerRef: React.MutableRefObject<NodeJS.Timeout | null>;
  lastUserMessageRef: React.MutableRefObject<string | null>;
}

/**
 * Execute the agent loop - handles multi-turn conversations with tool execution
 */
export async function executeAgentLoop(
  context: AgentLoopContext,
  initialAssistantMsgId: string
): Promise<void> {
  const {
    sendToLLM,
    cancelRequest,
    currentModel,
    systemPrompt,
    toolSchemas,
    contextActions,
    addMessage,
    updateMessage,
    serviceContainer,
    compressionOccurred,
    compressionRetryCount,
    resetCompressionFlags,
    inflightTokenAccumulatorRef,
    inflightFlushTimerRef,
    lastUserMessageRef,
  } = context;

  const maxTurns = 5;
  let turnCount = 0;
  let stopLoop = false;
  const currentAssistantMsgId = initialAssistantMsgId;
  
  // Track initial model at start of agent loop
  const initialModel = currentModel;

  while (turnCount < maxTurns && !stopLoop) {
    turnCount++;
    
    // Detect model change mid-loop
    if (currentModel !== initialModel) {
      addMessage({
        role: 'system',
        content: 'Model changed during conversation. Completing current turn...',
        excludeFromContext: true
      });
      stopLoop = true;
    }
    
    // Prepare history from authoritative context manager
    const currentContext = await contextActions.getContext();
    
    // DEBUG: Write context to file before filtering
    try {
      fs.appendFileSync('context-before-filter.log', `\n[${new Date().toISOString()}] Turn ${turnCount}\n`);
      fs.appendFileSync('context-before-filter.log', `Total messages: ${currentContext.length}\n`);
      currentContext.forEach((m: ContextMessage, i: number) => {
        fs.appendFileSync('context-before-filter.log', `  [${i}] ${m.role} (id: ${m.id}): ${m.content?.substring(0, 100)}...\n`);
      });
    } catch (_e) { /* ignore */ }
    
    // Exclude system messages from the payload; system prompt is sent separately
    const history = currentContext
      .filter((m: ContextMessage) => m.role !== 'system')
      .map((m: ContextMessage) => ({
        role: m.role as 'user' | 'assistant' | 'system' | 'tool',
        content: m.content || '',
        toolCalls: m.toolCalls?.map(tc => ({
          id: tc.id,
          name: tc.name,
          args: tc.args
        })),
        toolCallId: m.toolCallId
      }));

    let toolCallReceived: CoreToolCall | null = null;
    let assistantContent = '';
    let thinkingContent = '';

    // DEBUG: Log exact request being sent to LLM
    console.log('=== LLM REQUEST DEBUG ===');
    console.log('[DEBUG] System Prompt (first 500 chars):', systemPrompt?.substring(0, 500));
    console.log('[DEBUG] History length:', history.length);
    console.log('[DEBUG] History roles:', history.map((m: {role: string}) => m.role));
    console.log('[DEBUG] Tools being sent:', toolSchemas?.map(t => t.name) || 'NONE');
    console.log('=========================');

    // Emit before_model hook event
    if (serviceContainer) {
      const hookService = serviceContainer.getHookService();
      hookService.emitEvent('before_model', {
        model: currentModel,
        turn: turnCount,
        historyLength: history.length,
        toolsAvailable: toolSchemas?.length || 0,
        timestamp: new Date().toISOString(),
      });
    }

    // Calculate mode-specific temperature
    const temperature = (() => {
      const modeManager = contextActions.getModeManager();
      if (modeManager) {
        return modeManager.getPreferredTemperature(modeManager.getCurrentMode());
      }
      return undefined;
    })();

    try {
      await sendToLLM(
        history,
        // onText callback
        (text: string) => {
          const targetId = currentAssistantMsgId;
          assistantContent += text;
          
          // Estimate tokens for this chunk and batch-report as in-flight
          try {
            if (contextActions && contextActions.reportInflightTokens) {
              const estimatedTokens = Math.max(1, Math.ceil(text.length / 4));
              inflightTokenAccumulatorRef.current += estimatedTokens;
              
              // Schedule a flush if not already scheduled
              if (!inflightFlushTimerRef.current) {
                inflightFlushTimerRef.current = setTimeout(() => {
                  try {
                    const toReport = inflightTokenAccumulatorRef.current;
                    inflightTokenAccumulatorRef.current = 0;
                    inflightFlushTimerRef.current = null;
                    if (toReport > 0) {
                      contextActions.reportInflightTokens(toReport);
                    }
                  } catch (_e) {
                    inflightTokenAccumulatorRef.current = 0;
                    inflightFlushTimerRef.current = null;
                  }
                }, 500);
              }
            }
          } catch (_e) {
            // ignore estimation/report errors
          }
          
          // Update message with content
          updateMessage(targetId, { content: assistantContent });
        },
        // onError callback
        (error: string) => {
          const targetId = currentAssistantMsgId;
          updateMessage(targetId, {
            content: assistantContent ? `${assistantContent}\n\n**Error:** ${error}` : `Error: ${error}`,
            excludeFromContext: true
          });
          
          // Clear any inflight token accounting
          try { 
            if (inflightFlushTimerRef.current) { 
              clearTimeout(inflightFlushTimerRef.current); 
              inflightFlushTimerRef.current = null; 
              inflightTokenAccumulatorRef.current = 0; 
            }
            contextActions?.clearInflightTokens(); 
          } catch (_e) { /* ignore cleanup errors */ }
          
          stopLoop = true;
        },
        // onComplete callback
        (metrics?: ProviderMetrics, _finishReason?: 'stop' | 'length' | 'tool') => {
          const targetId = currentAssistantMsgId;
          if (metrics) {
            const updates: Partial<Message> = {
              metrics: {
                promptTokens: metrics.promptEvalCount,
                completionTokens: metrics.evalCount,
                totalDuration: metrics.totalDuration,
                promptDuration: metrics.promptEvalDuration,
                evalDuration: metrics.evalDuration,
                tokensPerSecond: metrics.evalDuration > 0 
                  ? Math.round((metrics.evalCount / (metrics.evalDuration / 1e9)) * 100) / 100 
                  : 0,
                timeToFirstToken: 0,
                totalSeconds: Math.round((metrics.totalDuration / 1e9) * 100) / 100,
                loadDuration: metrics.loadDuration
              }
            };
            
            updateMessage(targetId, updates);
          }
          
          // Emit after_model hook event
          if (serviceContainer) {
            const hookService = serviceContainer.getHookService();
            hookService.emitEvent('after_model', {
              model: currentModel,
              turn: turnCount,
              metrics: metrics ? {
                promptTokens: metrics.promptEvalCount,
                completionTokens: metrics.evalCount,
                totalSeconds: metrics.totalDuration / 1e9,
              } : undefined,
              timestamp: new Date().toISOString(),
            });
          }
          
          // Flush any pending inflight tokens
          try { 
            if (inflightFlushTimerRef.current) { 
              clearTimeout(inflightFlushTimerRef.current); 
              inflightFlushTimerRef.current = null; 
            }
            const pending = inflightTokenAccumulatorRef.current;
            inflightTokenAccumulatorRef.current = 0;
            if (pending > 0) { 
              contextActions?.reportInflightTokens(pending); 
            }
            contextActions?.clearInflightTokens();
          } catch (_e) { /* ignore */ }
        },
        // onToolCall callback
        (toolCall: CoreToolCall) => {
          toolCallReceived = toolCall;
        },
        // onThinking callback - Handle Ollama native thinking
        (thinking: string) => {
          const targetId = currentAssistantMsgId;
          thinkingContent += thinking;
          
          updateMessage(targetId, {
            reasoning: {
              content: thinkingContent,
              tokenCount: thinkingContent.split(/\s+/).length,
              duration: 0,
              complete: false,
            }
          });
        },
        toolSchemas,
        systemPrompt,
        120000, // timeout (ms)
        temperature
      );

      // Handle compression retry logic
      if (compressionOccurred && compressionRetryCount < 1) {
        // Retry logic would go here
        // For now, simplified
        resetCompressionFlags();
      }

      // Add assistant turn to context manager if it produced content OR tool calls
      if (assistantContent || toolCallReceived) {
        const tc = toolCallReceived as CoreToolCall | null;
        await contextActions.addMessage({
          role: 'assistant',
          content: assistantContent,
          toolCalls: tc ? [{
            id: tc.id,
            name: tc.name,
            args: tc.args
          }] : undefined
        });
      }

      // Handle tool execution if tool call was received
      if (toolCallReceived) {
        // Tool execution logic would go here
        // This is complex and should be in its own function
        stopLoop = true; // Simplified for now
      } else {
        stopLoop = true;
      }
    } catch (turnErr) {
      console.error('Agent Turn Error:', turnErr);
      stopLoop = true;
    }
  }
}
