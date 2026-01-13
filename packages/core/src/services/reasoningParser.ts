/**
 * Reasoning Parser Service
 * 
 * Parses and extracts reasoning blocks from model outputs.
 * Supports streaming parsing with state management.
 * Handles <think>...</think> blocks from reasoning models.
 */

export interface ReasoningBlock {
  content: string;
  tokenCount: number;
  duration: number;
  complete: boolean;
}

export interface ParserState {
  buffer: string;
  inThinkBlock: boolean;
  thinkContent: string;
  responseContent: string;
  thinkStartIndex: number;
}

export interface ParseResult {
  reasoning: ReasoningBlock | null;
  response: string;
}

export class ReasoningParser {
  /**
   * Parse complete text for reasoning blocks
   * Extracts <think>...</think> blocks and separates them from response
   */
  parse(text: string): ParseResult {
    const thinkRegex = /<think>([\s\S]*?)<\/think>/g;
    let thinkContent = '';
    let match;
    let hasThinkBlocks = false;
    
    // Extract all think blocks
    while ((match = thinkRegex.exec(text)) !== null) {
      hasThinkBlocks = true;
      thinkContent += match[1];
    }
    
    // If no think blocks found, return original text as response
    if (!hasThinkBlocks) {
      return {
        reasoning: null,
        response: text
      };
    }
    
    // Remove think blocks from response (including empty ones)
    const response = text.replace(/<think>[\s\S]*?<\/think>/g, '');
    
    // Only return reasoning if there's actual content (not just whitespace)
    const trimmedThinkContent = thinkContent.trim();
    if (trimmedThinkContent.length > 0) {
      return {
        reasoning: {
          content: trimmedThinkContent,
          tokenCount: this.estimateTokenCount(trimmedThinkContent),
          duration: 0, // Will be set by caller
          complete: true
        },
        response
      };
    }
    
    // Empty think blocks - return null reasoning but cleaned response
    return {
      reasoning: null,
      response
    };
  }
  
  /**
   * Parse streaming chunks with state management
   * Handles partial blocks and maintains state across chunks
   */
  parseStreaming(chunk: string, state: ParserState): ParserState {
    const newState = { ...state };
    newState.buffer += chunk;
    
    // Process the buffer
    while (newState.buffer.length > 0) {
      if (!newState.inThinkBlock) {
        // Look for opening tag
        const openTagIndex = newState.buffer.indexOf('<think>');
        
        if (openTagIndex === -1) {
          // Check if buffer might contain partial opening tag
          const partialMatches = ['<', '<t', '<th', '<thi', '<thin', '<think'];
          let hasPartial = false;
          
          for (const partial of partialMatches) {
            if (newState.buffer.endsWith(partial)) {
              // Keep partial tag in buffer, add rest to response
              const contentLength = newState.buffer.length - partial.length;
              if (contentLength > 0) {
                newState.responseContent += newState.buffer.slice(0, contentLength);
                newState.buffer = partial;
              }
              hasPartial = true;
              break;
            }
          }
          
          if (!hasPartial) {
            // No opening tag or partial tag, add all to response
            newState.responseContent += newState.buffer;
            newState.buffer = '';
          }
          break;
        }
        
        // Found opening tag
        // Add content before tag to response
        if (openTagIndex > 0) {
          newState.responseContent += newState.buffer.slice(0, openTagIndex);
        }
        newState.inThinkBlock = true;
        newState.buffer = newState.buffer.slice(openTagIndex + 7); // Skip '<think>'
      } else {
        // Look for closing tag
        const closeTagIndex = newState.buffer.indexOf('</think>');
        
        if (closeTagIndex === -1) {
          // Check if buffer might contain partial closing tag
          const partialMatches = ['<', '</', '</t', '</th', '</thi', '</thin', '</think'];
          let hasPartial = false;
          
          for (const partial of partialMatches) {
            if (newState.buffer.endsWith(partial)) {
              // Keep partial tag in buffer, add rest to think content
              const contentLength = newState.buffer.length - partial.length;
              if (contentLength > 0) {
                newState.thinkContent += newState.buffer.slice(0, contentLength);
                newState.buffer = partial;
              }
              hasPartial = true;
              break;
            }
          }
          
          if (!hasPartial) {
            // No closing tag or partial tag, add all to think content
            newState.thinkContent += newState.buffer;
            newState.buffer = '';
          }
          break;
        }
        
        // Found closing tag
        if (closeTagIndex > 0) {
          newState.thinkContent += newState.buffer.slice(0, closeTagIndex);
        }
        newState.inThinkBlock = false;
        newState.buffer = newState.buffer.slice(closeTagIndex + 8); // Skip '</think>'
        // Continue processing remaining buffer
      }
    }
    
    return newState;
  }
  
  /**
   * Create initial parser state
   */
  createInitialState(): ParserState {
    return {
      buffer: '',
      inThinkBlock: false,
      thinkContent: '',
      responseContent: '',
      thinkStartIndex: 0
    };
  }
  
  /**
   * Extract final result from parser state
   */
  extractResult(state: ParserState, duration: number = 0): ParseResult {
    const trimmedThinkContent = state.thinkContent.trim();
    
    if (trimmedThinkContent.length > 0) {
      return {
        reasoning: {
          content: trimmedThinkContent,
          tokenCount: this.estimateTokenCount(trimmedThinkContent),
          duration,
          complete: !state.inThinkBlock
        },
        response: state.responseContent.trim()
      };
    }
    
    return {
      reasoning: null,
      response: state.responseContent.trim()
    };
  }
  
  /**
   * Handle nested think blocks
   * Extracts all nested blocks and flattens them
   */
  parseNested(text: string): ParseResult {
    // For nested blocks, we'll extract all content between any <think> and </think>
    // This handles cases like <think>outer <think>inner</think> outer</think>
    
    let depth = 0;
    let thinkContent = '';
    let responseContent = '';
    let currentThinkStart = -1;
    
    for (let i = 0; i < text.length; i++) {
      // Check for opening tag
      if (text.slice(i, i + 7) === '<think>') {
        if (depth === 0) {
          currentThinkStart = i + 7;
        }
        depth++;
        i += 6; // Skip the rest of the tag
        continue;
      }
      
      // Check for closing tag
      if (text.slice(i, i + 8) === '</think>') {
        depth--;
        if (depth === 0 && currentThinkStart !== -1) {
          thinkContent += text.slice(currentThinkStart, i);
          currentThinkStart = -1;
        }
        i += 7; // Skip the rest of the tag
        continue;
      }
      
      // Add to appropriate content
      if (depth === 0) {
        responseContent += text[i];
      }
    }
    
    const trimmedThinkContent = thinkContent.trim();
    if (trimmedThinkContent.length > 0) {
      return {
        reasoning: {
          content: trimmedThinkContent,
          tokenCount: this.estimateTokenCount(trimmedThinkContent),
          duration: 0,
          complete: depth === 0
        },
        response: responseContent.trim()
      };
    }
    
    return {
      reasoning: null,
      response: text
    };
  }
  
  /**
   * Handle malformed blocks
   * Attempts to extract content even from incomplete or malformed blocks
   */
  parseMalformed(text: string): ParseResult {
    // Try standard parsing first
    const standardResult = this.parse(text);
    if (standardResult.reasoning) {
      return standardResult;
    }
    
    // Look for unclosed think blocks
    const openTagIndex = text.indexOf('<think>');
    if (openTagIndex !== -1) {
      const thinkContent = text.slice(openTagIndex + 7);
      const closeTagIndex = thinkContent.indexOf('</think>');
      
      if (closeTagIndex === -1) {
        // Unclosed block - treat everything after <think> as thinking
        return {
          reasoning: {
            content: thinkContent.trim(),
            tokenCount: this.estimateTokenCount(thinkContent),
            duration: 0,
            complete: false
          },
          response: text.slice(0, openTagIndex).trim()
        };
      }
    }
    
    // Look for orphaned closing tags
    const closeTagIndex = text.indexOf('</think>');
    if (closeTagIndex !== -1) {
      // Treat everything before closing tag as thinking
      return {
        reasoning: {
          content: text.slice(0, closeTagIndex).trim(),
          tokenCount: this.estimateTokenCount(text.slice(0, closeTagIndex)),
          duration: 0,
          complete: true
        },
        response: text.slice(closeTagIndex + 8).trim()
      };
    }
    
    // No think blocks found
    return {
      reasoning: null,
      response: text
    };
  }
  
  /**
   * Estimate token count (rough approximation)
   * Uses ~4 characters per token as a heuristic
   */
  private estimateTokenCount(text: string): number {
    return Math.ceil(text.length / 4);
  }
}
