/**
 * Policy Engine
 *
 * Evaluates policy rules to determine if tool execution requires user confirmation.
 * The engine supports tool-specific rules, wildcard rules, and conditional matching
 * based on tool parameters.
 */

import {
  PolicyConfig,
  PolicyDecision,
  PolicyRule,
  PolicyCondition,
  RiskLevel,
  DEFAULT_POLICY_CONFIG,
} from './policyRules.js';
import { ToolCallConfirmationDetails } from '../tools/types.js';

/**
 * Result of policy evaluation
 */
export interface PolicyEvaluationResult {
  /**
   * The decision: allow, deny, or ask
   */
  decision: PolicyDecision;

  /**
   * The rule that matched, if any
   */
  matchedRule?: PolicyRule;

  /**
   * Risk level for this operation
   */
  risk: RiskLevel;

  /**
   * Custom message from the matched rule
   */
  message?: string;
}

/**
 * Policy Engine class
 *
 * Evaluates policy rules against tool invocations to determine
 * whether execution should be allowed, denied, or require confirmation.
 */
export class PolicyEngine {
  private config: PolicyConfig;

  /**
   * Create a new PolicyEngine
   *
   * @param config Policy configuration (uses defaults if not provided)
   */
  constructor(config?: PolicyConfig) {
    this.config = config ?? DEFAULT_POLICY_CONFIG;
  }

  /**
   * Evaluate policy for a tool invocation
   *
   * @param toolName Name of the tool being invoked
   * @param params Parameters passed to the tool
   * @returns The policy decision (allow, deny, or ask)
   */
  evaluate(
    toolName: string,
    params: Record<string, unknown> = {}
  ): PolicyDecision {
    const result = this.evaluateWithDetails(toolName, params);
    return result.decision;
  }


  /**
   * Evaluate policy with full details
   *
   * @param toolName Name of the tool being invoked
   * @param params Parameters passed to the tool
   * @returns Full evaluation result including matched rule and risk level
   */
  evaluateWithDetails(
    toolName: string,
    params: Record<string, unknown> = {}
  ): PolicyEvaluationResult {
    const rule = this.findMatchingRule(toolName, params);

    if (rule) {
      return {
        decision: rule.action,
        matchedRule: rule,
        risk: rule.risk ?? this.inferRiskLevel(toolName),
        message: rule.message,
      };
    }

    return {
      decision: this.config.defaultAction,
      risk: this.inferRiskLevel(toolName),
    };
  }

  /**
   * Get the risk level for a tool
   *
   * @param toolName Name of the tool
   * @returns Risk level (low, medium, or high)
   */
  getRiskLevel(toolName: string): RiskLevel {
    // Check for tool-specific rule with risk defined
    const rule = this.config.rules.find(
      (r) => r.tool === toolName && r.risk !== undefined
    );

    if (rule?.risk) {
      return rule.risk;
    }

    return this.inferRiskLevel(toolName);
  }

  /**
   * Generate confirmation details for a tool invocation
   *
   * @param toolName Name of the tool
   * @param description Human-readable description of the operation
   * @param locations File paths or resources affected
   * @returns Confirmation details object
   */
  getConfirmationDetails(
    toolName: string,
    description: string,
    locations?: string[]
  ): ToolCallConfirmationDetails {
    return {
      toolName,
      description,
      risk: this.getRiskLevel(toolName),
      locations,
    };
  }

  /**
   * Update the policy configuration
   *
   * @param config New policy configuration
   */
  setConfig(config: PolicyConfig): void {
    this.config = config;
  }

  /**
   * Get the current policy configuration
   *
   * @returns Current policy configuration
   */
  getConfig(): PolicyConfig {
    return this.config;
  }

  /**
   * Add a rule to the policy configuration
   *
   * @param rule Rule to add
   * @param prepend If true, add to beginning of rules list (higher priority)
   */
  addRule(rule: PolicyRule, prepend = false): void {
    if (prepend) {
      this.config.rules.unshift(rule);
    } else {
      this.config.rules.push(rule);
    }
  }

  /**
   * Remove rules matching a tool name
   *
   * @param toolName Tool name to remove rules for
   * @returns Number of rules removed
   */
  removeRulesForTool(toolName: string): number {
    const initialLength = this.config.rules.length;
    this.config.rules = this.config.rules.filter((r) => r.tool !== toolName);
    return initialLength - this.config.rules.length;
  }

  /**
   * Find the first matching rule for a tool invocation
   *
   * Rules are evaluated in this order:
   * 1. Tool-specific rules (in order they appear in config)
   * 2. Wildcard rules (in order they appear in config)
   *
   * @param toolName Name of the tool
   * @param params Parameters passed to the tool
   * @returns Matching rule or undefined
   */
  private findMatchingRule(
    toolName: string,
    params: Record<string, unknown>
  ): PolicyRule | undefined {
    // First pass: check tool-specific rules
    for (const rule of this.config.rules) {
      if (rule.tool === toolName) {
        if (this.evaluateConditions(rule.conditions, params)) {
          return rule;
        }
      }
    }

    // Second pass: check wildcard rules
    for (const rule of this.config.rules) {
      if (rule.tool === '*') {
        if (this.evaluateConditions(rule.conditions, params)) {
          return rule;
        }
      }
    }

    return undefined;
  }


  /**
   * Evaluate all conditions for a rule
   *
   * @param conditions Array of conditions to evaluate
   * @param params Parameters to check against
   * @returns True if all conditions pass (or no conditions exist)
   */
  private evaluateConditions(
    conditions: PolicyCondition[] | undefined,
    params: Record<string, unknown>
  ): boolean {
    // No conditions means the rule always matches
    if (!conditions || conditions.length === 0) {
      return true;
    }

    // All conditions must pass
    return conditions.every((condition) =>
      this.evaluateCondition(condition, params)
    );
  }

  /**
   * Evaluate a single condition
   *
   * @param condition Condition to evaluate
   * @param params Parameters to check against
   * @returns True if the condition passes
   */
  private evaluateCondition(
    condition: PolicyCondition,
    params: Record<string, unknown>
  ): boolean {
    const value = params[condition.param];

    // If the parameter doesn't exist, condition fails
    if (value === undefined) {
      return false;
    }

    const valueStr = String(value);
    const conditionValue = condition.value;

    switch (condition.operator) {
      case 'equals':
        if (Array.isArray(conditionValue)) {
          return conditionValue.includes(valueStr);
        }
        return valueStr === conditionValue;

      case 'contains':
        if (Array.isArray(conditionValue)) {
          return conditionValue.some((v) => valueStr.includes(v));
        }
        return valueStr.includes(conditionValue);

      case 'startsWith':
        if (Array.isArray(conditionValue)) {
          return conditionValue.some((v) => valueStr.startsWith(v));
        }
        return valueStr.startsWith(conditionValue);

      case 'matches':
        try {
          const pattern = Array.isArray(conditionValue)
            ? conditionValue[0]
            : conditionValue;
          return new RegExp(pattern).test(valueStr);
        } catch {
          // Invalid regex, condition fails
          return false;
        }

      default:
        return false;
    }
  }

  /**
   * Infer risk level based on tool name
   *
   * @param toolName Name of the tool
   * @returns Inferred risk level
   */
  private inferRiskLevel(toolName: string): RiskLevel {
    // Read-only operations are low risk
    if (
      toolName.startsWith('read') ||
      toolName === 'ls' ||
      toolName === 'glob' ||
      toolName === 'grep' ||
      toolName === 'memory' ||
      toolName.startsWith('web_')
    ) {
      return 'low';
    }

    // Write operations are medium risk
    if (
      toolName.startsWith('write') ||
      toolName.startsWith('edit') ||
      toolName === 'write_todos'
    ) {
      return 'medium';
    }

    // Shell execution is high risk
    if (toolName === 'shell') {
      return 'high';
    }

    // Default to medium for unknown tools
    return 'medium';
  }
}
