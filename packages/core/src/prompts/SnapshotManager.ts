/**
 * Snapshot Manager for Dynamic Prompt System
 * 
 * Manages mode-aware context snapshots for preserving conversation state across mode transitions.
 * Supports both lightweight JSON snapshots (for quick transitions) and full XML snapshots (for compression).
 */

import { promises as fs } from 'fs';
import { join } from 'path';
import type { Message } from '../provider/types.js';
import type { ModeType } from './ContextAnalyzer.js';

/**
 * Mode-specific findings from specialized modes
 */
export interface ModeFindings {
  debugger?: {
    errors: string[];
    rootCause: string | null;
    fixes: string[];
  };
  security?: {
    vulnerabilities: string[];
    recommendations: string[];
  };
  reviewer?: {
    issues: string[];
    suggestions: string[];
    positives?: string[];
  };
  performance?: {
    bottlenecks: string[];
    optimizations: string[];
    estimatedImprovement?: string;
  };
}

/**
 * Lightweight JSON snapshot for mode transitions
 */
export interface ModeTransitionSnapshot {
  id: string;
  timestamp: Date;
  fromMode: ModeType;
  toMode: ModeType;
  
  // Recent conversation context (last 5 messages)
  recentMessages: {
    role: 'user' | 'assistant' | 'system';
    content: string;
    timestamp: Date;
  }[];
  
  // Active state
  activeSkills: string[];
  activeTools: string[];
  currentTask: string | null;
  
  // Mode-specific findings (for specialized modes)
  findings?: ModeFindings;
}

/**
 * Options for creating snapshots
 */
export interface SnapshotOptions {
  sessionId?: string;
  storagePath?: string;
  maxCacheSize?: number;
  pruneAfterMs?: number;
}

/**
 * Snapshot Manager
 * 
 * Manages creation, storage, and retrieval of mode-aware context snapshots.
 */
export class SnapshotManager {
  private cache: Map<string, ModeTransitionSnapshot> = new Map();
  private readonly maxCacheSize: number;
  private readonly pruneAfterMs: number;
  private readonly storagePath: string;
  private readonly sessionId: string;
  
  constructor(options: SnapshotOptions = {}) {
    this.maxCacheSize = options.maxCacheSize ?? 10;
    this.pruneAfterMs = options.pruneAfterMs ?? 3600000; // 1 hour
    this.sessionId = options.sessionId ?? 'default';
    this.storagePath = options.storagePath ?? join(process.cwd(), '.ollm', 'snapshots');
  }
  
  /**
   * Initialize the snapshot manager (create storage directories)
   */
  async initialize(): Promise<void> {
    const sessionPath = join(this.storagePath, `session-${this.sessionId}`);
    await fs.mkdir(sessionPath, { recursive: true });
  }
  
  /**
   * Create a lightweight JSON snapshot for mode transitions
   */
  createTransitionSnapshot(
    fromMode: ModeType,
    toMode: ModeType,
    context: {
      messages: Message[];
      activeSkills: string[];
      activeTools: string[];
      currentTask?: string;
      findings?: ModeFindings;
    }
  ): ModeTransitionSnapshot {
    // Extract last 5 messages
    const recentMessages = context.messages
      .slice(-5)
      .map(msg => ({
        role: msg.role as 'user' | 'assistant' | 'system',
        content: this.extractMessageContent(msg),
        timestamp: new Date()
      }));
    
    const snapshot: ModeTransitionSnapshot = {
      id: this.generateSnapshotId(),
      timestamp: new Date(),
      fromMode,
      toMode,
      recentMessages,
      activeSkills: context.activeSkills,
      activeTools: context.activeTools,
      currentTask: context.currentTask ?? null,
      findings: context.findings
    };
    
    return snapshot;
  }
  
  /**
   * Create a full XML snapshot for compression and long-term storage
   */
  async createFullSnapshot(messages: Message[]): Promise<string> {
    // Extract overall goal from first user message
    const firstUserMessage = messages.find(m => m.role === 'user');
    const overallGoal = firstUserMessage 
      ? this.extractMessageContent(firstUserMessage).slice(0, 200)
      : 'No goal specified';
    
    // Extract key knowledge from conversation
    const keyKnowledge = this.extractKeyKnowledge(messages);
    
    // Extract file system state
    const fileSystemState = this.extractFileSystemState(messages);
    
    // Extract current plan
    const currentPlan = this.extractCurrentPlan(messages);
    
    // Build XML snapshot
    const xml = `<state_snapshot>
  <overall_goal>
    ${this.escapeXml(overallGoal)}
  </overall_goal>

  <key_knowledge>
${keyKnowledge.map(k => `    - ${this.escapeXml(k)}`).join('\n')}
  </key_knowledge>

  <file_system_state>
${fileSystemState.map(f => `    - ${this.escapeXml(f)}`).join('\n')}
  </file_system_state>

  <current_plan>
${currentPlan.map(p => `    ${this.escapeXml(p)}`).join('\n')}
  </current_plan>
</state_snapshot>`;
    
    return xml;
  }
  
  /**
   * Store a snapshot in memory cache and optionally on disk
   */
  async storeSnapshot(snapshot: ModeTransitionSnapshot, persistToDisk = true): Promise<void> {
    // Store in memory cache
    const key = this.getSnapshotKey(snapshot.fromMode, snapshot.toMode);
    
    // Evict oldest if cache is full
    if (this.cache.size >= this.maxCacheSize) {
      const oldestKey = this.cache.keys().next().value;
      if (oldestKey) {
        this.cache.delete(oldestKey);
      }
    }
    
    this.cache.set(key, snapshot);
    
    // Persist to disk asynchronously
    if (persistToDisk) {
      await this.persistSnapshot(snapshot);
    }
  }
  
  /**
   * Retrieve a snapshot by mode transition
   */
  getSnapshot(fromMode: ModeType, toMode: ModeType): ModeTransitionSnapshot | null {
    const key = this.getSnapshotKey(fromMode, toMode);
    return this.cache.get(key) ?? null;
  }
  
  /**
   * Get the most recent snapshot
   */
  getLatestSnapshot(): ModeTransitionSnapshot | null {
    if (this.cache.size === 0) {
      return null;
    }
    
    // Get all snapshots and find the most recent
    const snapshots = Array.from(this.cache.values());
    return snapshots.reduce((latest, current) => 
      current.timestamp > latest.timestamp ? current : latest
    );
  }
  
  /**
   * Prune old snapshots (older than pruneAfterMs)
   */
  async pruneSnapshots(): Promise<number> {
    const now = Date.now();
    const cutoffTime = now - this.pruneAfterMs;
    let prunedCount = 0;
    
    // Prune from memory cache
    for (const [key, snapshot] of this.cache.entries()) {
      if (snapshot.timestamp.getTime() < cutoffTime) {
        this.cache.delete(key);
        prunedCount++;
      }
    }
    
    // Prune from disk
    try {
      const sessionPath = join(this.storagePath, `session-${this.sessionId}`);
      const files = await fs.readdir(sessionPath);
      
      for (const file of files) {
        if (file.startsWith('transition-') && file.endsWith('.json')) {
          const filePath = join(sessionPath, file);
          const stats = await fs.stat(filePath);
          
          if (stats.mtime.getTime() < cutoffTime) {
            await fs.unlink(filePath);
            prunedCount++;
          }
        }
      }
    } catch (error) {
      // Ignore errors during pruning
    }
    
    return prunedCount;
  }
  
  /**
   * Clear all snapshots from memory cache
   */
  clearCache(): void {
    this.cache.clear();
  }
  
  /**
   * Get cache statistics
   */
  getCacheStats(): { size: number; maxSize: number; snapshots: string[] } {
    return {
      size: this.cache.size,
      maxSize: this.maxCacheSize,
      snapshots: Array.from(this.cache.keys())
    };
  }
  
  /**
   * Format findings from a snapshot for injection into conversation
   */
  formatFindings(snapshot: ModeTransitionSnapshot): string | null {
    if (!snapshot.findings) {
      return null;
    }
    
    const parts: string[] = [];
    
    // Format debugger findings
    if (snapshot.findings.debugger) {
      const { errors, rootCause, fixes } = snapshot.findings.debugger;
      parts.push('[Debugger Findings]');
      if (errors.length > 0) {
        parts.push(`Errors: ${errors.join(', ')}`);
      }
      if (rootCause) {
        parts.push(`Root Cause: ${rootCause}`);
      }
      if (fixes.length > 0) {
        parts.push(`Suggested Fixes:\n${fixes.map((f, i) => `  ${i + 1}. ${f}`).join('\n')}`);
      }
      parts.push('\nContinue implementation with these findings in mind.');
    }
    
    // Format security findings
    if (snapshot.findings.security) {
      const { vulnerabilities, recommendations } = snapshot.findings.security;
      parts.push('[Security Audit Results]');
      if (vulnerabilities.length > 0) {
        parts.push(`Vulnerabilities Found: ${vulnerabilities.length}`);
        parts.push(vulnerabilities.map((v, i) => `  ${i + 1}. ${v}`).join('\n'));
      }
      if (recommendations.length > 0) {
        parts.push('\nRecommendations:');
        parts.push(recommendations.map((r, i) => `  ${i + 1}. ${r}`).join('\n'));
      }
      parts.push('\nApply these security fixes before continuing.');
    }
    
    // Format reviewer findings
    if (snapshot.findings.reviewer) {
      const { issues, suggestions, positives } = snapshot.findings.reviewer;
      parts.push('[Code Review Results]');
      if (issues.length > 0) {
        parts.push(`Issues Found: ${issues.length}`);
        parts.push(issues.map((i, idx) => `  ${idx + 1}. ${i}`).join('\n'));
      }
      if (suggestions.length > 0) {
        parts.push('\nSuggestions:');
        parts.push(suggestions.map((s, idx) => `  ${idx + 1}. ${s}`).join('\n'));
      }
      if (positives && positives.length > 0) {
        parts.push('\nPositive Aspects:');
        parts.push(positives.map((p, idx) => `  ${idx + 1}. ${p}`).join('\n'));
      }
    }
    
    // Format performance findings
    if (snapshot.findings.performance) {
      const { bottlenecks, optimizations, estimatedImprovement } = snapshot.findings.performance;
      parts.push('[Performance Analysis Results]');
      if (bottlenecks.length > 0) {
        parts.push(`Bottlenecks Identified: ${bottlenecks.length}`);
        parts.push(bottlenecks.map((b, i) => `  ${i + 1}. ${b}`).join('\n'));
      }
      if (optimizations.length > 0) {
        parts.push('\nRecommended Optimizations:');
        parts.push(optimizations.map((o, i) => `  ${i + 1}. ${o}`).join('\n'));
      }
      if (estimatedImprovement) {
        parts.push(`\nEstimated Improvement: ${estimatedImprovement}`);
      }
    }
    
    return parts.length > 0 ? parts.join('\n') : null;
  }
  
  /**
   * Add findings to an existing snapshot
   */
  addFindings(
    fromMode: ModeType,
    toMode: ModeType,
    findings: ModeFindings
  ): boolean {
    const key = this.getSnapshotKey(fromMode, toMode);
    const snapshot = this.cache.get(key);
    
    if (!snapshot) {
      return false;
    }
    
    // Merge findings
    snapshot.findings = {
      ...snapshot.findings,
      ...findings
    };
    
    // Update in cache
    this.cache.set(key, snapshot);
    
    return true;
  }
  
  // Private helper methods
  
  private generateSnapshotId(): string {
    return `snapshot-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  }
  
  private getSnapshotKey(fromMode: ModeType, toMode: ModeType): string {
    return `${fromMode}->${toMode}`;
  }
  
  private extractMessageContent(message: Message): string {
    return message.parts
      .filter(part => part.type === 'text')
      .map(part => (part as { type: 'text'; text: string }).text)
      .join('\n');
  }
  
  private extractKeyKnowledge(messages: Message[]): string[] {
    const knowledge: string[] = [];
    
    // Look for assistant messages with technical information
    for (const msg of messages) {
      if (msg.role === 'assistant') {
        const content = this.extractMessageContent(msg);
        
        // Extract lines that look like key facts
        const lines = content.split('\n');
        for (const line of lines) {
          const trimmed = line.trim();
          if (
            trimmed.length > 0 && (
              trimmed.toLowerCase().includes('using') ||
              trimmed.toLowerCase().includes('with') ||
              trimmed.toLowerCase().includes('library:') ||
              trimmed.toLowerCase().includes('framework:') ||
              trimmed.toLowerCase().includes('database:')
            )
          ) {
            knowledge.push(trimmed);
          }
        }
      }
    }
    
    return knowledge.slice(0, 10); // Limit to 10 items
  }
  
  private extractFileSystemState(messages: Message[]): string[] {
    const fileOps: string[] = [];
    
    // Look for file operations in messages
    for (const msg of messages) {
      const content = this.extractMessageContent(msg);
      
      // Extract file operations
      if (content.includes('CREATED:') || content.includes('MODIFIED:') || content.includes('DELETED:')) {
        const lines = content.split('\n');
        for (const line of lines) {
          if (line.includes('CREATED:') || line.includes('MODIFIED:') || line.includes('DELETED:')) {
            fileOps.push(line.trim());
          }
        }
      }
    }
    
    return fileOps.slice(-20); // Last 20 operations
  }
  
  private extractCurrentPlan(messages: Message[]): string[] {
    const plan: string[] = [];
    
    // Look for numbered lists or task lists
    for (const msg of messages) {
      const content = this.extractMessageContent(msg);
      const lines = content.split('\n');
      
      for (const line of lines) {
        // Match numbered lists (1., 2., etc.) or task lists (- [ ], - [x], etc.)
        if (/^\s*\d+\./.test(line) || /^\s*-\s*\[[ x]\]/.test(line)) {
          plan.push(line.trim());
        }
      }
    }
    
    return plan.slice(-15); // Last 15 plan items
  }
  
  private escapeXml(text: string): string {
    return text
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&apos;');
  }
  
  private async persistSnapshot(snapshot: ModeTransitionSnapshot): Promise<void> {
    try {
      const sessionPath = join(this.storagePath, `session-${this.sessionId}`);
      const filename = `transition-${snapshot.timestamp.getTime()}.json`;
      const filePath = join(sessionPath, filename);
      
      await fs.writeFile(filePath, JSON.stringify(snapshot, null, 2), 'utf-8');
    } catch (error) {
      // Log error but don't throw - disk persistence is optional
      console.error('Failed to persist snapshot:', error);
    }
  }
}
