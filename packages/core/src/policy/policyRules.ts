/**
 * Policy Rules Type Definitions
 *
 * This module defines the types for policy rules that control tool execution.
 * Rules can allow, deny, or ask for confirmation based on tool name and parameters.
 */

/**
 * Policy decision types
 */
export type PolicyDecision = 'allow' | 'deny' | 'ask';

/**
 * Risk level classification for tools
 */
export type RiskLevel = 'low' | 'medium' | 'high';

/**
 * Condition operators for parameter matching
 */
export type ConditionOperator = 'equals' | 'contains' | 'matches' | 'startsWith';

/**
 * A condition that must be met for a rule to apply
 */
export interface PolicyCondition {
  /**
   * Parameter name to check
   */
  param: string;

  /**
   * Comparison operator
   */
  operator: ConditionOperator;

  /**
   * Value(s) to compare against
   */
  value: string | string[];
}

/**
 * A policy rule that determines how a tool invocation should be handled
 */
export interface PolicyRule {
  /**
   * Tool name this rule applies to, or '*' for all tools
   */
  tool: string;

  /**
   * Action to take when this rule matches
   */
  action: PolicyDecision;

  /**
   * Optional risk level override for this rule
   */
  risk?: RiskLevel;

  /**
   * Optional custom confirmation message
   */
  message?: string;

  /**
   * Optional conditions that must all be met for this rule to apply
   */
  conditions?: PolicyCondition[];
}

/**
 * Configuration for the policy engine
 */
export interface PolicyConfig {
  /**
   * Default action when no rule matches
   */
  defaultAction: PolicyDecision;

  /**
   * List of policy rules (evaluated in order)
   */
  rules: PolicyRule[];
}

/**
 * Default policy configuration
 */
export const DEFAULT_POLICY_CONFIG: PolicyConfig = {
  defaultAction: 'ask',
  rules: [
    // Read operations are generally safe
    { tool: 'read_file', action: 'allow', risk: 'low' },
    { tool: 'read_many_files', action: 'allow', risk: 'low' },
    { tool: 'glob', action: 'allow', risk: 'low' },
    { tool: 'grep', action: 'allow', risk: 'low' },
    { tool: 'ls', action: 'allow', risk: 'low' },
    { tool: 'memory', action: 'allow', risk: 'low' },
    { tool: 'web_search', action: 'allow', risk: 'low' },
    { tool: 'web_fetch', action: 'allow', risk: 'low' },

    // Write operations require confirmation by default
    { tool: 'write_file', action: 'ask', risk: 'medium' },
    { tool: 'edit_file', action: 'ask', risk: 'medium' },
    { tool: 'write_todos', action: 'ask', risk: 'low' },

    // Shell is high risk
    { tool: 'shell', action: 'ask', risk: 'high' },
  ],
};
