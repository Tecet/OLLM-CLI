/**
 * Policy Engine Tests
 *
 * Tests for the PolicyEngine class that evaluates policy rules
 * to determine tool execution permissions.
 */

import { describe, it, expect, beforeEach } from 'vitest';
import fc from 'fast-check';
import { PolicyEngine } from '../policyEngine.js';
import {
  PolicyConfig,
  PolicyDecision,
  DEFAULT_POLICY_CONFIG,
} from '../policyRules.js';

describe('PolicyEngine', () => {
  let engine: PolicyEngine;

  beforeEach(() => {
    engine = new PolicyEngine();
  });

  describe('constructor', () => {
    it('should use default config when none provided', () => {
      const config = engine.getConfig();
      expect(config).toEqual(DEFAULT_POLICY_CONFIG);
    });

    it('should use provided config', () => {
      const customConfig: PolicyConfig = {
        defaultAction: 'deny',
        rules: [{ tool: 'test_tool', action: 'allow' }],
      };
      const customEngine = new PolicyEngine(customConfig);
      expect(customEngine.getConfig()).toEqual(customConfig);
    });
  });

  describe('evaluate', () => {
    it('should return allow for read_file with default config', () => {
      const decision = engine.evaluate('read_file', { path: '/test.txt' });
      expect(decision).toBe('allow');
    });

    it('should return ask for write_file with default config', () => {
      const decision = engine.evaluate('write_file', {
        path: '/test.txt',
        content: 'test',
      });
      expect(decision).toBe('ask');
    });

    it('should return ask for shell with default config', () => {
      const decision = engine.evaluate('shell', { command: 'ls' });
      expect(decision).toBe('ask');
    });

    it('should return default action for unknown tools', () => {
      const decision = engine.evaluate('unknown_tool', {});
      expect(decision).toBe('ask'); // default is 'ask'
    });
  });

  describe('evaluateWithDetails', () => {
    it('should return matched rule when found', () => {
      const result = engine.evaluateWithDetails('read_file', {
        path: '/test.txt',
      });
      expect(result.decision).toBe('allow');
      expect(result.matchedRule).toBeDefined();
      expect(result.matchedRule?.tool).toBe('read_file');
      expect(result.risk).toBe('low');
    });

    it('should return no matched rule when using default', () => {
      const result = engine.evaluateWithDetails('unknown_tool', {});
      expect(result.decision).toBe('ask');
      expect(result.matchedRule).toBeUndefined();
    });
  });


  describe('rule precedence', () => {
    it('should check tool-specific rules before wildcard rules', () => {
      const config: PolicyConfig = {
        defaultAction: 'deny',
        rules: [
          { tool: '*', action: 'deny' },
          { tool: 'read_file', action: 'allow' },
        ],
      };
      const customEngine = new PolicyEngine(config);

      // Tool-specific rule should take precedence
      expect(customEngine.evaluate('read_file', {})).toBe('allow');
      // Wildcard should apply to other tools
      expect(customEngine.evaluate('other_tool', {})).toBe('deny');
    });

    it('should evaluate rules in order for same tool', () => {
      const config: PolicyConfig = {
        defaultAction: 'deny',
        rules: [
          {
            tool: 'shell',
            action: 'allow',
            conditions: [{ param: 'command', operator: 'startsWith', value: 'ls' }],
          },
          { tool: 'shell', action: 'ask' },
        ],
      };
      const customEngine = new PolicyEngine(config);

      // First matching rule wins
      expect(customEngine.evaluate('shell', { command: 'ls -la' })).toBe('allow');
      expect(customEngine.evaluate('shell', { command: 'rm -rf' })).toBe('ask');
    });
  });

  describe('condition evaluation', () => {
    describe('equals operator', () => {
      it('should match exact string value', () => {
        const config: PolicyConfig = {
          defaultAction: 'deny',
          rules: [
            {
              tool: 'test',
              action: 'allow',
              conditions: [{ param: 'mode', operator: 'equals', value: 'safe' }],
            },
          ],
        };
        const customEngine = new PolicyEngine(config);

        expect(customEngine.evaluate('test', { mode: 'safe' })).toBe('allow');
        expect(customEngine.evaluate('test', { mode: 'unsafe' })).toBe('deny');
      });

      it('should match any value in array', () => {
        const config: PolicyConfig = {
          defaultAction: 'deny',
          rules: [
            {
              tool: 'test',
              action: 'allow',
              conditions: [
                { param: 'type', operator: 'equals', value: ['read', 'list'] },
              ],
            },
          ],
        };
        const customEngine = new PolicyEngine(config);

        expect(customEngine.evaluate('test', { type: 'read' })).toBe('allow');
        expect(customEngine.evaluate('test', { type: 'list' })).toBe('allow');
        expect(customEngine.evaluate('test', { type: 'write' })).toBe('deny');
      });
    });

    describe('contains operator', () => {
      it('should match substring', () => {
        const config: PolicyConfig = {
          defaultAction: 'allow',
          rules: [
            {
              tool: 'shell',
              action: 'deny',
              conditions: [{ param: 'command', operator: 'contains', value: 'rm' }],
            },
          ],
        };
        const customEngine = new PolicyEngine(config);

        expect(customEngine.evaluate('shell', { command: 'rm -rf /' })).toBe('deny');
        expect(customEngine.evaluate('shell', { command: 'ls -la' })).toBe('allow');
      });

      it('should match any substring in array', () => {
        const config: PolicyConfig = {
          defaultAction: 'allow',
          rules: [
            {
              tool: 'shell',
              action: 'deny',
              conditions: [
                { param: 'command', operator: 'contains', value: ['rm', 'del'] },
              ],
            },
          ],
        };
        const customEngine = new PolicyEngine(config);

        expect(customEngine.evaluate('shell', { command: 'rm file' })).toBe('deny');
        expect(customEngine.evaluate('shell', { command: 'del file' })).toBe('deny');
        expect(customEngine.evaluate('shell', { command: 'ls' })).toBe('allow');
      });
    });

    describe('startsWith operator', () => {
      it('should match prefix', () => {
        const config: PolicyConfig = {
          defaultAction: 'deny',
          rules: [
            {
              tool: 'write_file',
              action: 'allow',
              conditions: [
                { param: 'path', operator: 'startsWith', value: '/tmp/' },
              ],
            },
          ],
        };
        const customEngine = new PolicyEngine(config);

        expect(customEngine.evaluate('write_file', { path: '/tmp/test.txt' })).toBe(
          'allow'
        );
        expect(customEngine.evaluate('write_file', { path: '/etc/passwd' })).toBe(
          'deny'
        );
      });

      it('should match any prefix in array', () => {
        const config: PolicyConfig = {
          defaultAction: 'deny',
          rules: [
            {
              tool: 'write_file',
              action: 'allow',
              conditions: [
                {
                  param: 'path',
                  operator: 'startsWith',
                  value: ['/tmp/', '/var/tmp/'],
                },
              ],
            },
          ],
        };
        const customEngine = new PolicyEngine(config);

        expect(customEngine.evaluate('write_file', { path: '/tmp/a.txt' })).toBe(
          'allow'
        );
        expect(customEngine.evaluate('write_file', { path: '/var/tmp/b.txt' })).toBe(
          'allow'
        );
        expect(customEngine.evaluate('write_file', { path: '/home/user' })).toBe(
          'deny'
        );
      });
    });


    describe('matches operator', () => {
      it('should match regex pattern', () => {
        const config: PolicyConfig = {
          defaultAction: 'deny',
          rules: [
            {
              tool: 'write_file',
              action: 'allow',
              conditions: [
                { param: 'path', operator: 'matches', value: '\\.txt$' },
              ],
            },
          ],
        };
        const customEngine = new PolicyEngine(config);

        expect(customEngine.evaluate('write_file', { path: '/test.txt' })).toBe(
          'allow'
        );
        expect(customEngine.evaluate('write_file', { path: '/test.js' })).toBe(
          'deny'
        );
      });

      it('should handle invalid regex gracefully', () => {
        const config: PolicyConfig = {
          defaultAction: 'allow',
          rules: [
            {
              tool: 'test',
              action: 'deny',
              conditions: [
                { param: 'value', operator: 'matches', value: '[invalid' },
              ],
            },
          ],
        };
        const customEngine = new PolicyEngine(config);

        // Invalid regex should fail the condition, falling through to default
        expect(customEngine.evaluate('test', { value: 'anything' })).toBe('allow');
      });
    });

    describe('multiple conditions', () => {
      it('should require all conditions to pass', () => {
        const config: PolicyConfig = {
          defaultAction: 'deny',
          rules: [
            {
              tool: 'write_file',
              action: 'allow',
              conditions: [
                { param: 'path', operator: 'startsWith', value: '/tmp/' },
                { param: 'path', operator: 'matches', value: '\\.txt$' },
              ],
            },
          ],
        };
        const customEngine = new PolicyEngine(config);

        // Both conditions must pass
        expect(customEngine.evaluate('write_file', { path: '/tmp/test.txt' })).toBe(
          'allow'
        );
        // Only first condition passes
        expect(customEngine.evaluate('write_file', { path: '/tmp/test.js' })).toBe(
          'deny'
        );
        // Only second condition passes
        expect(customEngine.evaluate('write_file', { path: '/home/test.txt' })).toBe(
          'deny'
        );
      });
    });

    describe('missing parameters', () => {
      it('should fail condition when parameter is missing', () => {
        const config: PolicyConfig = {
          defaultAction: 'allow',
          rules: [
            {
              tool: 'test',
              action: 'deny',
              conditions: [{ param: 'required', operator: 'equals', value: 'yes' }],
            },
          ],
        };
        const customEngine = new PolicyEngine(config);

        // Missing parameter fails the condition
        expect(customEngine.evaluate('test', {})).toBe('allow');
        expect(customEngine.evaluate('test', { required: 'yes' })).toBe('deny');
      });
    });
  });

  describe('getRiskLevel', () => {
    it('should return risk from rule when defined', () => {
      expect(engine.getRiskLevel('read_file')).toBe('low');
      expect(engine.getRiskLevel('write_file')).toBe('medium');
      expect(engine.getRiskLevel('shell')).toBe('high');
    });

    it('should infer risk for unknown tools', () => {
      expect(engine.getRiskLevel('read_something')).toBe('low');
      expect(engine.getRiskLevel('write_something')).toBe('medium');
      expect(engine.getRiskLevel('edit_something')).toBe('medium');
      expect(engine.getRiskLevel('unknown')).toBe('medium');
    });
  });

  describe('getConfirmationDetails', () => {
    it('should generate confirmation details', () => {
      const details = engine.getConfirmationDetails(
        'write_file',
        'Write to /test.txt',
        ['/test.txt']
      );

      expect(details.toolName).toBe('write_file');
      expect(details.description).toBe('Write to /test.txt');
      expect(details.risk).toBe('medium');
      expect(details.locations).toEqual(['/test.txt']);
    });

    it('should use inferred risk for unknown tools', () => {
      const details = engine.getConfirmationDetails('shell', 'Execute: ls', ['.']);

      expect(details.risk).toBe('high');
    });
  });

  describe('configuration management', () => {
    it('should allow setting new config', () => {
      const newConfig: PolicyConfig = {
        defaultAction: 'allow',
        rules: [],
      };
      engine.setConfig(newConfig);
      expect(engine.getConfig()).toEqual(newConfig);
    });

    it('should allow adding rules', () => {
      const initialRuleCount = engine.getConfig().rules.length;
      engine.addRule({ tool: 'new_tool', action: 'deny' });
      expect(engine.getConfig().rules.length).toBe(initialRuleCount + 1);
    });

    it('should allow prepending rules', () => {
      engine.addRule({ tool: 'priority_tool', action: 'deny' }, true);
      expect(engine.getConfig().rules[0].tool).toBe('priority_tool');
    });

    it('should allow removing rules for a tool', () => {
      const removed = engine.removeRulesForTool('read_file');
      expect(removed).toBeGreaterThan(0);
      expect(engine.evaluate('read_file', {})).toBe('ask'); // Falls to default
    });
  });
});


describe('Property 33: Policy Decision Evaluation', () => {
  // Feature: stage-03-tools-policy, Property 33: Policy Decision Evaluation
  // *For any* tool and parameters, the Policy_Engine should return 'allow' if a matching
  // allow rule exists, 'deny' if a deny rule exists, 'ask' if an ask rule exists,
  // or the default action if no rule matches.
  // **Validates: Requirements 7.1, 7.2, 7.3, 7.5**

  // Generator for valid tool names
  const toolNameArb = fc
    .stringOf(fc.constantFrom('a', 'b', 'c', 'd', 'e', '_', '-', '1', '2'), {
      minLength: 1,
      maxLength: 20,
    })
    .filter((s) => /^[a-z]/.test(s)); // Must start with a letter

  // Generator for policy decisions
  const policyDecisionArb = fc.constantFrom<PolicyDecision>('allow', 'deny', 'ask');

  // Generator for simple parameters
  const paramsArb = fc.dictionary(
    fc.string({ minLength: 1, maxLength: 10 }).filter((s) => /^[a-z]/.test(s)),
    fc.string({ minLength: 0, maxLength: 50 }),
    { minKeys: 0, maxKeys: 5 }
  );

  it('should return allow when a matching allow rule exists (Requirement 7.1)', () => {
    fc.assert(
      fc.property(toolNameArb, paramsArb, (toolName, params) => {
        const config: PolicyConfig = {
          defaultAction: 'deny', // Use deny as default to ensure allow comes from rule
          rules: [{ tool: toolName, action: 'allow' }],
        };
        const engine = new PolicyEngine(config);

        const decision = engine.evaluate(toolName, params);

        expect(decision).toBe('allow');
        return true;
      }),
      { numRuns: 100 }
    );
  });

  it('should return deny when a matching deny rule exists (Requirement 7.2)', () => {
    fc.assert(
      fc.property(toolNameArb, paramsArb, (toolName, params) => {
        const config: PolicyConfig = {
          defaultAction: 'allow', // Use allow as default to ensure deny comes from rule
          rules: [{ tool: toolName, action: 'deny' }],
        };
        const engine = new PolicyEngine(config);

        const decision = engine.evaluate(toolName, params);

        expect(decision).toBe('deny');
        return true;
      }),
      { numRuns: 100 }
    );
  });

  it('should return ask when a matching ask rule exists (Requirement 7.3)', () => {
    fc.assert(
      fc.property(toolNameArb, paramsArb, (toolName, params) => {
        const config: PolicyConfig = {
          defaultAction: 'allow', // Use allow as default to ensure ask comes from rule
          rules: [{ tool: toolName, action: 'ask' }],
        };
        const engine = new PolicyEngine(config);

        const decision = engine.evaluate(toolName, params);

        expect(decision).toBe('ask');
        return true;
      }),
      { numRuns: 100 }
    );
  });

  it('should return default action when no rule matches (Requirement 7.5)', () => {
    fc.assert(
      fc.property(
        toolNameArb,
        toolNameArb,
        policyDecisionArb,
        paramsArb,
        (toolName, otherToolName, defaultAction, params) => {
          // Ensure the tool names are different
          if (toolName === otherToolName) return true;

          const config: PolicyConfig = {
            defaultAction,
            rules: [{ tool: otherToolName, action: 'deny' }], // Rule for a different tool
          };
          const engine = new PolicyEngine(config);

          const decision = engine.evaluate(toolName, params);

          // Should return the default action since no rule matches
          expect(decision).toBe(defaultAction);
          return true;
        }
      ),
      { numRuns: 100 }
    );
  });

  it('should correctly evaluate any rule action for any tool', () => {
    fc.assert(
      fc.property(
        toolNameArb,
        policyDecisionArb,
        policyDecisionArb,
        paramsArb,
        (toolName, ruleAction, defaultAction, params) => {
          const config: PolicyConfig = {
            defaultAction,
            rules: [{ tool: toolName, action: ruleAction }],
          };
          const engine = new PolicyEngine(config);

          const decision = engine.evaluate(toolName, params);

          // The decision should match the rule action (not the default)
          expect(decision).toBe(ruleAction);
          return true;
        }
      ),
      { numRuns: 100 }
    );
  });

  it('should handle multiple rules and return the first matching rule action', () => {
    fc.assert(
      fc.property(
        toolNameArb,
        policyDecisionArb,
        policyDecisionArb,
        paramsArb,
        (toolName, firstAction, secondAction, params) => {
          const config: PolicyConfig = {
            defaultAction: 'deny',
            rules: [
              { tool: toolName, action: firstAction },
              { tool: toolName, action: secondAction },
            ],
          };
          const engine = new PolicyEngine(config);

          const decision = engine.evaluate(toolName, params);

          // Should return the first matching rule's action
          expect(decision).toBe(firstAction);
          return true;
        }
      ),
      { numRuns: 100 }
    );
  });

  it('should return default action for empty rules array', () => {
    fc.assert(
      fc.property(
        toolNameArb,
        policyDecisionArb,
        paramsArb,
        (toolName, defaultAction, params) => {
          const config: PolicyConfig = {
            defaultAction,
            rules: [],
          };
          const engine = new PolicyEngine(config);

          const decision = engine.evaluate(toolName, params);

          expect(decision).toBe(defaultAction);
          return true;
        }
      ),
      { numRuns: 100 }
    );
  });

  it('should evaluate correctly with evaluateWithDetails', () => {
    fc.assert(
      fc.property(
        toolNameArb,
        policyDecisionArb,
        policyDecisionArb,
        paramsArb,
        (toolName, ruleAction, defaultAction, params) => {
          const config: PolicyConfig = {
            defaultAction,
            rules: [{ tool: toolName, action: ruleAction }],
          };
          const engine = new PolicyEngine(config);

          const result = engine.evaluateWithDetails(toolName, params);

          // Decision should match rule action
          expect(result.decision).toBe(ruleAction);
          // Matched rule should be defined
          expect(result.matchedRule).toBeDefined();
          expect(result.matchedRule?.tool).toBe(toolName);
          expect(result.matchedRule?.action).toBe(ruleAction);

          return true;
        }
      ),
      { numRuns: 100 }
    );
  });

  it('should return undefined matchedRule when using default action', () => {
    fc.assert(
      fc.property(
        toolNameArb,
        toolNameArb,
        policyDecisionArb,
        paramsArb,
        (toolName, otherToolName, defaultAction, params) => {
          // Ensure the tool names are different
          if (toolName === otherToolName) return true;

          const config: PolicyConfig = {
            defaultAction,
            rules: [{ tool: otherToolName, action: 'deny' }],
          };
          const engine = new PolicyEngine(config);

          const result = engine.evaluateWithDetails(toolName, params);

          // Decision should be default action
          expect(result.decision).toBe(defaultAction);
          // No matched rule
          expect(result.matchedRule).toBeUndefined();

          return true;
        }
      ),
      { numRuns: 100 }
    );
  });
});


describe('Property 34: Policy Rule Precedence', () => {
  // Feature: stage-03-tools-policy, Property 34: Policy Rule Precedence
  // *For any* tool with both a tool-specific rule and a wildcard rule,
  // the Policy_Engine should apply the tool-specific rule.
  // **Validates: Requirements 7.4**

  // Generator for valid tool names (must start with a letter)
  const toolNameArb = fc
    .stringOf(fc.constantFrom('a', 'b', 'c', 'd', 'e', 'f', 'g', '_', '-', '1', '2'), {
      minLength: 1,
      maxLength: 20,
    })
    .filter((s) => /^[a-z]/.test(s));

  // Generator for policy decisions
  const policyDecisionArb = fc.constantFrom<PolicyDecision>('allow', 'deny', 'ask');

  // Generator for simple parameters
  const paramsArb = fc.dictionary(
    fc.string({ minLength: 1, maxLength: 10 }).filter((s) => /^[a-z]/.test(s)),
    fc.string({ minLength: 0, maxLength: 50 }),
    { minKeys: 0, maxKeys: 5 }
  );

  it('should apply tool-specific rule over wildcard rule regardless of rule order', () => {
    fc.assert(
      fc.property(
        toolNameArb,
        policyDecisionArb,
        policyDecisionArb,
        policyDecisionArb,
        paramsArb,
        fc.boolean(),
        (toolName, toolSpecificAction, wildcardAction, defaultAction, params, wildcardFirst) => {
          // Skip if actions are the same (can't distinguish which rule was applied)
          if (toolSpecificAction === wildcardAction) return true;

          // Create config with both tool-specific and wildcard rules
          // Order depends on wildcardFirst flag to test both orderings
          const rules = wildcardFirst
            ? [
                { tool: '*', action: wildcardAction },
                { tool: toolName, action: toolSpecificAction },
              ]
            : [
                { tool: toolName, action: toolSpecificAction },
                { tool: '*', action: wildcardAction },
              ];

          const config: PolicyConfig = {
            defaultAction,
            rules,
          };
          const engine = new PolicyEngine(config);

          const decision = engine.evaluate(toolName, params);

          // Tool-specific rule should always take precedence
          expect(decision).toBe(toolSpecificAction);
          return true;
        }
      ),
      { numRuns: 100 }
    );
  });

  it('should apply wildcard rule when no tool-specific rule exists', () => {
    fc.assert(
      fc.property(
        toolNameArb,
        toolNameArb,
        policyDecisionArb,
        policyDecisionArb,
        paramsArb,
        (toolName, otherToolName, wildcardAction, defaultAction, params) => {
          // Ensure tool names are different
          if (toolName === otherToolName) return true;
          // Skip if wildcard action equals default (can't distinguish)
          if (wildcardAction === defaultAction) return true;

          const config: PolicyConfig = {
            defaultAction,
            rules: [
              { tool: otherToolName, action: 'deny' }, // Rule for a different tool
              { tool: '*', action: wildcardAction },
            ],
          };
          const engine = new PolicyEngine(config);

          const decision = engine.evaluate(toolName, params);

          // Wildcard rule should apply since no tool-specific rule exists
          expect(decision).toBe(wildcardAction);
          return true;
        }
      ),
      { numRuns: 100 }
    );
  });

  it('should apply tool-specific rule even when multiple wildcard rules exist', () => {
    fc.assert(
      fc.property(
        toolNameArb,
        policyDecisionArb,
        policyDecisionArb,
        policyDecisionArb,
        policyDecisionArb,
        paramsArb,
        (toolName, toolSpecificAction, wildcard1Action, wildcard2Action, defaultAction, params) => {
          // Skip if tool-specific action matches any wildcard action
          if (toolSpecificAction === wildcard1Action || toolSpecificAction === wildcard2Action) {
            return true;
          }

          const config: PolicyConfig = {
            defaultAction,
            rules: [
              { tool: '*', action: wildcard1Action },
              { tool: toolName, action: toolSpecificAction },
              { tool: '*', action: wildcard2Action },
            ],
          };
          const engine = new PolicyEngine(config);

          const decision = engine.evaluate(toolName, params);

          // Tool-specific rule should take precedence over all wildcards
          expect(decision).toBe(toolSpecificAction);
          return true;
        }
      ),
      { numRuns: 100 }
    );
  });

  it('should apply first matching wildcard rule when no tool-specific rule exists', () => {
    fc.assert(
      fc.property(
        toolNameArb,
        policyDecisionArb,
        policyDecisionArb,
        policyDecisionArb,
        paramsArb,
        (toolName, wildcard1Action, wildcard2Action, defaultAction, params) => {
          // Skip if wildcard actions are the same
          if (wildcard1Action === wildcard2Action) return true;

          const config: PolicyConfig = {
            defaultAction,
            rules: [
              { tool: '*', action: wildcard1Action },
              { tool: '*', action: wildcard2Action },
            ],
          };
          const engine = new PolicyEngine(config);

          const decision = engine.evaluate(toolName, params);

          // First wildcard rule should be applied
          expect(decision).toBe(wildcard1Action);
          return true;
        }
      ),
      { numRuns: 100 }
    );
  });

  it('should verify precedence with evaluateWithDetails', () => {
    fc.assert(
      fc.property(
        toolNameArb,
        policyDecisionArb,
        policyDecisionArb,
        policyDecisionArb,
        paramsArb,
        (toolName, toolSpecificAction, wildcardAction, defaultAction, params) => {
          // Skip if actions are the same
          if (toolSpecificAction === wildcardAction) return true;

          const config: PolicyConfig = {
            defaultAction,
            rules: [
              { tool: '*', action: wildcardAction },
              { tool: toolName, action: toolSpecificAction },
            ],
          };
          const engine = new PolicyEngine(config);

          const result = engine.evaluateWithDetails(toolName, params);

          // Should match the tool-specific rule
          expect(result.decision).toBe(toolSpecificAction);
          expect(result.matchedRule).toBeDefined();
          expect(result.matchedRule?.tool).toBe(toolName);
          expect(result.matchedRule?.action).toBe(toolSpecificAction);

          return true;
        }
      ),
      { numRuns: 100 }
    );
  });

  it('should apply tool-specific rule with conditions over unconditional wildcard', () => {
    fc.assert(
      fc.property(
        toolNameArb,
        policyDecisionArb,
        policyDecisionArb,
        fc.string({ minLength: 1, maxLength: 20 }).filter((s) => /^[a-z]/.test(s)),
        fc.string({ minLength: 1, maxLength: 20 }),
        (toolName, toolSpecificAction, wildcardAction, paramName, paramValue) => {
          // Skip if actions are the same
          if (toolSpecificAction === wildcardAction) return true;

          const config: PolicyConfig = {
            defaultAction: 'deny',
            rules: [
              { tool: '*', action: wildcardAction },
              {
                tool: toolName,
                action: toolSpecificAction,
                conditions: [{ param: paramName, operator: 'equals', value: paramValue }],
              },
            ],
          };
          const engine = new PolicyEngine(config);

          // When condition is met, tool-specific rule should apply
          const decisionWithMatch = engine.evaluate(toolName, { [paramName]: paramValue });
          expect(decisionWithMatch).toBe(toolSpecificAction);

          // When condition is not met, wildcard should apply
          const decisionWithoutMatch = engine.evaluate(toolName, { [paramName]: 'other_value' });
          expect(decisionWithoutMatch).toBe(wildcardAction);

          return true;
        }
      ),
      { numRuns: 100 }
    );
  });
});


describe('Property 35: Policy Condition Evaluation', () => {
  // Feature: stage-03-tools-policy, Property 35: Policy Condition Evaluation
  // *For any* policy rule with conditions, the Policy_Engine should only apply
  // the rule if all conditions evaluate to true against the tool parameters.
  // **Validates: Requirements 7.6**

  // Generator for valid tool names (must start with a letter)
  const toolNameArb = fc
    .stringOf(fc.constantFrom('a', 'b', 'c', 'd', 'e', 'f', 'g', '_', '-', '1', '2'), {
      minLength: 1,
      maxLength: 20,
    })
    .filter((s) => /^[a-z]/.test(s));

  // Generator for policy decisions
  const policyDecisionArb = fc.constantFrom<PolicyDecision>('allow', 'deny', 'ask');

  // Generator for valid parameter names (must start with a letter)
  const paramNameArb = fc
    .stringOf(fc.constantFrom('a', 'b', 'c', 'd', 'e', 'f', 'g', 'h', 'i', 'j', 'k', 'l', 'm', 'n', 'o', 'p'), {
      minLength: 1,
      maxLength: 15,
    })
    .filter((s) => /^[a-z]/.test(s));

  // Generator for parameter values (alphanumeric strings)
  const paramValueArb = fc.stringOf(
    fc.constantFrom('a', 'b', 'c', 'd', 'e', 'f', 'g', '1', '2', '3', '_', '-'),
    { minLength: 1, maxLength: 20 }
  );

  // Generator for condition operators
  const operatorArb = fc.constantFrom<'equals' | 'contains' | 'startsWith' | 'matches'>(
    'equals',
    'contains',
    'startsWith',
    'matches'
  );

  it('should apply rule when equals condition matches exactly', () => {
    fc.assert(
      fc.property(
        toolNameArb,
        policyDecisionArb,
        policyDecisionArb,
        paramNameArb,
        paramValueArb,
        (toolName, ruleAction, defaultAction, paramName, paramValue) => {
          // Skip if actions are the same
          if (ruleAction === defaultAction) return true;

          const config: PolicyConfig = {
            defaultAction,
            rules: [
              {
                tool: toolName,
                action: ruleAction,
                conditions: [{ param: paramName, operator: 'equals', value: paramValue }],
              },
            ],
          };
          const engine = new PolicyEngine(config);

          // When condition matches, rule should apply
          const decisionMatch = engine.evaluate(toolName, { [paramName]: paramValue });
          expect(decisionMatch).toBe(ruleAction);

          // When condition doesn't match, default should apply
          const decisionNoMatch = engine.evaluate(toolName, { [paramName]: paramValue + '_different' });
          expect(decisionNoMatch).toBe(defaultAction);

          return true;
        }
      ),
      { numRuns: 100 }
    );
  });

  it('should apply rule when contains condition finds substring', () => {
    fc.assert(
      fc.property(
        toolNameArb,
        policyDecisionArb,
        policyDecisionArb,
        paramNameArb,
        paramValueArb,
        paramValueArb,
        (toolName, ruleAction, defaultAction, paramName, prefix, suffix) => {
          // Skip if actions are the same
          if (ruleAction === defaultAction) return true;

          const substring = 'target';
          const fullValue = prefix + substring + suffix;

          const config: PolicyConfig = {
            defaultAction,
            rules: [
              {
                tool: toolName,
                action: ruleAction,
                conditions: [{ param: paramName, operator: 'contains', value: substring }],
              },
            ],
          };
          const engine = new PolicyEngine(config);

          // When value contains substring, rule should apply
          const decisionMatch = engine.evaluate(toolName, { [paramName]: fullValue });
          expect(decisionMatch).toBe(ruleAction);

          // When value doesn't contain substring, default should apply
          const decisionNoMatch = engine.evaluate(toolName, { [paramName]: prefix + suffix });
          expect(decisionNoMatch).toBe(defaultAction);

          return true;
        }
      ),
      { numRuns: 100 }
    );
  });

  it('should apply rule when startsWith condition matches prefix', () => {
    fc.assert(
      fc.property(
        toolNameArb,
        policyDecisionArb,
        policyDecisionArb,
        paramNameArb,
        paramValueArb,
        paramValueArb,
        (toolName, ruleAction, defaultAction, paramName, prefix, suffix) => {
          // Skip if actions are the same
          if (ruleAction === defaultAction) return true;

          const config: PolicyConfig = {
            defaultAction,
            rules: [
              {
                tool: toolName,
                action: ruleAction,
                conditions: [{ param: paramName, operator: 'startsWith', value: prefix }],
              },
            ],
          };
          const engine = new PolicyEngine(config);

          // When value starts with prefix, rule should apply
          const decisionMatch = engine.evaluate(toolName, { [paramName]: prefix + suffix });
          expect(decisionMatch).toBe(ruleAction);

          // When value doesn't start with prefix, default should apply
          const decisionNoMatch = engine.evaluate(toolName, { [paramName]: 'x' + prefix + suffix });
          expect(decisionNoMatch).toBe(defaultAction);

          return true;
        }
      ),
      { numRuns: 100 }
    );
  });

  it('should apply rule when matches condition matches regex pattern', () => {
    fc.assert(
      fc.property(
        toolNameArb,
        policyDecisionArb,
        policyDecisionArb,
        paramNameArb,
        (toolName, ruleAction, defaultAction, paramName) => {
          // Skip if actions are the same
          if (ruleAction === defaultAction) return true;

          // Use a simple regex pattern that matches strings ending with .txt
          const config: PolicyConfig = {
            defaultAction,
            rules: [
              {
                tool: toolName,
                action: ruleAction,
                conditions: [{ param: paramName, operator: 'matches', value: '\\.txt$' }],
              },
            ],
          };
          const engine = new PolicyEngine(config);

          // When value matches pattern, rule should apply
          const decisionMatch = engine.evaluate(toolName, { [paramName]: 'file.txt' });
          expect(decisionMatch).toBe(ruleAction);

          // When value doesn't match pattern, default should apply
          const decisionNoMatch = engine.evaluate(toolName, { [paramName]: 'file.js' });
          expect(decisionNoMatch).toBe(defaultAction);

          return true;
        }
      ),
      { numRuns: 100 }
    );
  });

  it('should require ALL conditions to pass for rule to apply', () => {
    fc.assert(
      fc.property(
        toolNameArb,
        policyDecisionArb,
        policyDecisionArb,
        paramNameArb,
        paramNameArb,
        paramValueArb,
        paramValueArb,
        (toolName, ruleAction, defaultAction, paramName1, paramName2, value1, value2) => {
          // Skip if actions are the same or param names are the same
          if (ruleAction === defaultAction) return true;
          if (paramName1 === paramName2) return true;

          const config: PolicyConfig = {
            defaultAction,
            rules: [
              {
                tool: toolName,
                action: ruleAction,
                conditions: [
                  { param: paramName1, operator: 'equals', value: value1 },
                  { param: paramName2, operator: 'equals', value: value2 },
                ],
              },
            ],
          };
          const engine = new PolicyEngine(config);

          // When both conditions match, rule should apply
          const decisionBothMatch = engine.evaluate(toolName, {
            [paramName1]: value1,
            [paramName2]: value2,
          });
          expect(decisionBothMatch).toBe(ruleAction);

          // When only first condition matches, default should apply
          const decisionFirstOnly = engine.evaluate(toolName, {
            [paramName1]: value1,
            [paramName2]: value2 + '_wrong',
          });
          expect(decisionFirstOnly).toBe(defaultAction);

          // When only second condition matches, default should apply
          const decisionSecondOnly = engine.evaluate(toolName, {
            [paramName1]: value1 + '_wrong',
            [paramName2]: value2,
          });
          expect(decisionSecondOnly).toBe(defaultAction);

          // When neither condition matches, default should apply
          const decisionNeitherMatch = engine.evaluate(toolName, {
            [paramName1]: value1 + '_wrong',
            [paramName2]: value2 + '_wrong',
          });
          expect(decisionNeitherMatch).toBe(defaultAction);

          return true;
        }
      ),
      { numRuns: 100 }
    );
  });

  it('should fail condition when parameter is missing', () => {
    fc.assert(
      fc.property(
        toolNameArb,
        policyDecisionArb,
        policyDecisionArb,
        paramNameArb,
        paramValueArb,
        operatorArb,
        (toolName, ruleAction, defaultAction, paramName, paramValue, operator) => {
          // Skip if actions are the same
          if (ruleAction === defaultAction) return true;

          const config: PolicyConfig = {
            defaultAction,
            rules: [
              {
                tool: toolName,
                action: ruleAction,
                conditions: [{ param: paramName, operator, value: paramValue }],
              },
            ],
          };
          const engine = new PolicyEngine(config);

          // When parameter is missing, condition should fail and default should apply
          const decision = engine.evaluate(toolName, {});
          expect(decision).toBe(defaultAction);

          return true;
        }
      ),
      { numRuns: 100 }
    );
  });

  it('should apply rule with equals condition matching any value in array', () => {
    fc.assert(
      fc.property(
        toolNameArb,
        policyDecisionArb,
        policyDecisionArb,
        paramNameArb,
        paramValueArb,
        paramValueArb,
        paramValueArb,
        (toolName, ruleAction, defaultAction, paramName, value1, value2, value3) => {
          // Skip if actions are the same
          if (ruleAction === defaultAction) return true;
          // Ensure values are distinct
          if (value1 === value2 || value2 === value3 || value1 === value3) return true;

          const config: PolicyConfig = {
            defaultAction,
            rules: [
              {
                tool: toolName,
                action: ruleAction,
                conditions: [{ param: paramName, operator: 'equals', value: [value1, value2] }],
              },
            ],
          };
          const engine = new PolicyEngine(config);

          // When value matches first array element, rule should apply
          const decisionFirst = engine.evaluate(toolName, { [paramName]: value1 });
          expect(decisionFirst).toBe(ruleAction);

          // When value matches second array element, rule should apply
          const decisionSecond = engine.evaluate(toolName, { [paramName]: value2 });
          expect(decisionSecond).toBe(ruleAction);

          // When value doesn't match any array element, default should apply
          const decisionNoMatch = engine.evaluate(toolName, { [paramName]: value3 });
          expect(decisionNoMatch).toBe(defaultAction);

          return true;
        }
      ),
      { numRuns: 100 }
    );
  });

  it('should apply rule with contains condition matching any substring in array', () => {
    fc.assert(
      fc.property(
        toolNameArb,
        policyDecisionArb,
        policyDecisionArb,
        paramNameArb,
        (toolName, ruleAction, defaultAction, paramName) => {
          // Skip if actions are the same
          if (ruleAction === defaultAction) return true;

          const config: PolicyConfig = {
            defaultAction,
            rules: [
              {
                tool: toolName,
                action: ruleAction,
                conditions: [{ param: paramName, operator: 'contains', value: ['foo', 'bar'] }],
              },
            ],
          };
          const engine = new PolicyEngine(config);

          // When value contains first substring, rule should apply
          const decisionFirst = engine.evaluate(toolName, { [paramName]: 'prefix_foo_suffix' });
          expect(decisionFirst).toBe(ruleAction);

          // When value contains second substring, rule should apply
          const decisionSecond = engine.evaluate(toolName, { [paramName]: 'prefix_bar_suffix' });
          expect(decisionSecond).toBe(ruleAction);

          // When value doesn't contain any substring, default should apply
          const decisionNoMatch = engine.evaluate(toolName, { [paramName]: 'prefix_baz_suffix' });
          expect(decisionNoMatch).toBe(defaultAction);

          return true;
        }
      ),
      { numRuns: 100 }
    );
  });

  it('should apply rule with startsWith condition matching any prefix in array', () => {
    fc.assert(
      fc.property(
        toolNameArb,
        policyDecisionArb,
        policyDecisionArb,
        paramNameArb,
        (toolName, ruleAction, defaultAction, paramName) => {
          // Skip if actions are the same
          if (ruleAction === defaultAction) return true;

          const config: PolicyConfig = {
            defaultAction,
            rules: [
              {
                tool: toolName,
                action: ruleAction,
                conditions: [{ param: paramName, operator: 'startsWith', value: ['/tmp/', '/var/'] }],
              },
            ],
          };
          const engine = new PolicyEngine(config);

          // When value starts with first prefix, rule should apply
          const decisionFirst = engine.evaluate(toolName, { [paramName]: '/tmp/file.txt' });
          expect(decisionFirst).toBe(ruleAction);

          // When value starts with second prefix, rule should apply
          const decisionSecond = engine.evaluate(toolName, { [paramName]: '/var/log/app.log' });
          expect(decisionSecond).toBe(ruleAction);

          // When value doesn't start with any prefix, default should apply
          const decisionNoMatch = engine.evaluate(toolName, { [paramName]: '/home/user/file.txt' });
          expect(decisionNoMatch).toBe(defaultAction);

          return true;
        }
      ),
      { numRuns: 100 }
    );
  });

  it('should handle invalid regex gracefully in matches condition', () => {
    fc.assert(
      fc.property(
        toolNameArb,
        policyDecisionArb,
        policyDecisionArb,
        paramNameArb,
        paramValueArb,
        (toolName, ruleAction, defaultAction, paramName, paramValue) => {
          // Skip if actions are the same
          if (ruleAction === defaultAction) return true;

          const config: PolicyConfig = {
            defaultAction,
            rules: [
              {
                tool: toolName,
                action: ruleAction,
                conditions: [{ param: paramName, operator: 'matches', value: '[invalid' }],
              },
            ],
          };
          const engine = new PolicyEngine(config);

          // Invalid regex should fail the condition, falling through to default
          const decision = engine.evaluate(toolName, { [paramName]: paramValue });
          expect(decision).toBe(defaultAction);

          return true;
        }
      ),
      { numRuns: 100 }
    );
  });

  it('should correctly evaluate conditions with evaluateWithDetails', () => {
    fc.assert(
      fc.property(
        toolNameArb,
        policyDecisionArb,
        policyDecisionArb,
        paramNameArb,
        paramValueArb,
        (toolName, ruleAction, defaultAction, paramName, paramValue) => {
          // Skip if actions are the same
          if (ruleAction === defaultAction) return true;

          const config: PolicyConfig = {
            defaultAction,
            rules: [
              {
                tool: toolName,
                action: ruleAction,
                conditions: [{ param: paramName, operator: 'equals', value: paramValue }],
              },
            ],
          };
          const engine = new PolicyEngine(config);

          // When condition matches, should return matched rule
          const resultMatch = engine.evaluateWithDetails(toolName, { [paramName]: paramValue });
          expect(resultMatch.decision).toBe(ruleAction);
          expect(resultMatch.matchedRule).toBeDefined();
          expect(resultMatch.matchedRule?.tool).toBe(toolName);
          expect(resultMatch.matchedRule?.conditions).toBeDefined();
          expect(resultMatch.matchedRule?.conditions?.length).toBe(1);

          // When condition doesn't match, should return no matched rule
          const resultNoMatch = engine.evaluateWithDetails(toolName, { [paramName]: paramValue + '_wrong' });
          expect(resultNoMatch.decision).toBe(defaultAction);
          expect(resultNoMatch.matchedRule).toBeUndefined();

          return true;
        }
      ),
      { numRuns: 100 }
    );
  });

  it('should skip conditional rule and apply next matching rule when condition fails', () => {
    fc.assert(
      fc.property(
        toolNameArb,
        policyDecisionArb,
        policyDecisionArb,
        policyDecisionArb,
        paramNameArb,
        paramValueArb,
        (toolName, conditionalAction, unconditionalAction, defaultAction, paramName, paramValue) => {
          // Skip if actions are the same
          if (conditionalAction === unconditionalAction) return true;

          const config: PolicyConfig = {
            defaultAction,
            rules: [
              {
                tool: toolName,
                action: conditionalAction,
                conditions: [{ param: paramName, operator: 'equals', value: paramValue }],
              },
              {
                tool: toolName,
                action: unconditionalAction,
                // No conditions - always matches
              },
            ],
          };
          const engine = new PolicyEngine(config);

          // When condition matches, first rule should apply
          const decisionMatch = engine.evaluate(toolName, { [paramName]: paramValue });
          expect(decisionMatch).toBe(conditionalAction);

          // When condition doesn't match, second rule should apply
          const decisionNoMatch = engine.evaluate(toolName, { [paramName]: paramValue + '_wrong' });
          expect(decisionNoMatch).toBe(unconditionalAction);

          return true;
        }
      ),
      { numRuns: 100 }
    );
  });
});


describe('Property 36: Policy Risk Classification', () => {
  // Feature: stage-03-tools-policy, Property 36: Policy Risk Classification
  // *For any* tool, the Policy_Engine should classify it with a risk level of low, medium, or high.
  // **Validates: Requirements 7.7**

  // Generator for valid tool names (must start with a letter)
  const toolNameArb = fc
    .stringOf(fc.constantFrom('a', 'b', 'c', 'd', 'e', 'f', 'g', 'h', 'i', 'j', 'k', 'l', 'm', 'n', 'o', 'p', 'q', 'r', 's', 't', 'u', 'v', 'w', 'x', 'y', 'z', '_', '-', '1', '2', '3'), {
      minLength: 1,
      maxLength: 30,
    })
    .filter((s) => /^[a-z]/.test(s));

  // Generator for risk levels
  const riskLevelArb = fc.constantFrom<'low' | 'medium' | 'high'>('low', 'medium', 'high');

  // Generator for policy decisions
  const policyDecisionArb = fc.constantFrom<PolicyDecision>('allow', 'deny', 'ask');

  // Valid risk levels
  const validRiskLevels = ['low', 'medium', 'high'];

  it('should always return a valid risk level (low, medium, or high) for any tool', () => {
    fc.assert(
      fc.property(toolNameArb, (toolName) => {
        const engine = new PolicyEngine();
        const riskLevel = engine.getRiskLevel(toolName);

        // Risk level must be one of the valid values
        expect(validRiskLevels).toContain(riskLevel);
        return true;
      }),
      { numRuns: 100 }
    );
  });

  it('should return risk level from rule when explicitly defined', () => {
    fc.assert(
      fc.property(
        toolNameArb,
        riskLevelArb,
        policyDecisionArb,
        (toolName, expectedRisk, action) => {
          const config: PolicyConfig = {
            defaultAction: 'ask',
            rules: [{ tool: toolName, action, risk: expectedRisk }],
          };
          const engine = new PolicyEngine(config);

          const riskLevel = engine.getRiskLevel(toolName);

          // Should return the explicitly defined risk level
          expect(riskLevel).toBe(expectedRisk);
          return true;
        }
      ),
      { numRuns: 100 }
    );
  });

  it('should infer low risk for read-only tools', () => {
    // Tools that start with 'read' or 'web_' are low risk (prefix match)
    // Tools that are exactly 'ls', 'glob', 'grep', 'memory' are low risk (exact match)
    const readOnlyPrefixes = ['read', 'web_'];
    const readOnlyExactTools = ['ls', 'glob', 'grep', 'memory'];

    // Test prefix-based low risk tools
    fc.assert(
      fc.property(
        fc.constantFrom(...readOnlyPrefixes),
        fc.stringOf(fc.constantFrom('a', 'b', 'c', '_', '1', '2'), { minLength: 0, maxLength: 10 }),
        (prefix, suffix) => {
          const toolName = prefix + suffix;
          const engine = new PolicyEngine({
            defaultAction: 'ask',
            rules: [], // No rules, so risk is inferred
          });

          const riskLevel = engine.getRiskLevel(toolName);

          // Read-only tools should be low risk
          expect(riskLevel).toBe('low');
          return true;
        }
      ),
      { numRuns: 100 }
    );

    // Test exact-match low risk tools
    fc.assert(
      fc.property(
        fc.constantFrom(...readOnlyExactTools),
        (toolName) => {
          const engine = new PolicyEngine({
            defaultAction: 'ask',
            rules: [], // No rules, so risk is inferred
          });

          const riskLevel = engine.getRiskLevel(toolName);

          // Read-only tools should be low risk
          expect(riskLevel).toBe('low');
          return true;
        }
      ),
      { numRuns: 100 }
    );
  });

  it('should infer medium risk for write/edit tools', () => {
    // Tools that start with 'write' or 'edit'
    const writePrefixes = ['write', 'edit'];

    fc.assert(
      fc.property(
        fc.constantFrom(...writePrefixes),
        fc.stringOf(fc.constantFrom('a', 'b', 'c', '_', '1', '2'), { minLength: 0, maxLength: 10 }),
        (prefix, suffix) => {
          const toolName = prefix + suffix;
          const engine = new PolicyEngine({
            defaultAction: 'ask',
            rules: [], // No rules, so risk is inferred
          });

          const riskLevel = engine.getRiskLevel(toolName);

          // Write/edit tools should be medium risk
          expect(riskLevel).toBe('medium');
          return true;
        }
      ),
      { numRuns: 100 }
    );
  });

  it('should infer high risk for shell tool', () => {
    const engine = new PolicyEngine({
      defaultAction: 'ask',
      rules: [], // No rules, so risk is inferred
    });

    const riskLevel = engine.getRiskLevel('shell');

    // Shell should be high risk
    expect(riskLevel).toBe('high');
  });

  it('should infer medium risk for unknown tools', () => {
    // Generate tool names that don't match any known patterns
    const unknownToolArb = fc
      .stringOf(fc.constantFrom('a', 'b', 'c', 'd', 'e', 'f', 'g', 'h', 'i', 'j', 'k', 'l', 'm', 'n', 'o', 'p', 'q', 'x', 'y', 'z', '_'), {
        minLength: 1,
        maxLength: 20,
      })
      .filter((s) => {
        // Must start with a letter
        if (!/^[a-z]/.test(s)) return false;
        // Must not match any known patterns
        if (s.startsWith('read')) return false;
        if (s.startsWith('write')) return false;
        if (s.startsWith('edit')) return false;
        if (s.startsWith('web_')) return false;
        if (s === 'ls' || s === 'glob' || s === 'grep' || s === 'memory' || s === 'shell' || s === 'write_todos') return false;
        return true;
      });

    fc.assert(
      fc.property(unknownToolArb, (toolName) => {
        const engine = new PolicyEngine({
          defaultAction: 'ask',
          rules: [], // No rules, so risk is inferred
        });

        const riskLevel = engine.getRiskLevel(toolName);

        // Unknown tools should default to medium risk
        expect(riskLevel).toBe('medium');
        return true;
      }),
      { numRuns: 100 }
    );
  });

  it('should use rule-defined risk over inferred risk', () => {
    fc.assert(
      fc.property(
        fc.constantFrom('read_file', 'write_file', 'shell', 'unknown_tool'),
        riskLevelArb,
        (toolName, overrideRisk) => {
          const config: PolicyConfig = {
            defaultAction: 'ask',
            rules: [{ tool: toolName, action: 'allow', risk: overrideRisk }],
          };
          const engine = new PolicyEngine(config);

          const riskLevel = engine.getRiskLevel(toolName);

          // Rule-defined risk should override inferred risk
          expect(riskLevel).toBe(overrideRisk);
          return true;
        }
      ),
      { numRuns: 100 }
    );
  });

  it('should include risk level in evaluateWithDetails result', () => {
    fc.assert(
      fc.property(
        toolNameArb,
        riskLevelArb,
        policyDecisionArb,
        (toolName, expectedRisk, action) => {
          const config: PolicyConfig = {
            defaultAction: 'ask',
            rules: [{ tool: toolName, action, risk: expectedRisk }],
          };
          const engine = new PolicyEngine(config);

          const result = engine.evaluateWithDetails(toolName, {});

          // Risk level should be included in the result
          expect(validRiskLevels).toContain(result.risk);
          expect(result.risk).toBe(expectedRisk);
          return true;
        }
      ),
      { numRuns: 100 }
    );
  });

  it('should include inferred risk level in evaluateWithDetails when no rule defines risk', () => {
    fc.assert(
      fc.property(
        toolNameArb,
        policyDecisionArb,
        (toolName, action) => {
          const config: PolicyConfig = {
            defaultAction: 'ask',
            rules: [{ tool: toolName, action }], // No risk defined
          };
          const engine = new PolicyEngine(config);

          const result = engine.evaluateWithDetails(toolName, {});

          // Risk level should still be present (inferred)
          expect(validRiskLevels).toContain(result.risk);
          return true;
        }
      ),
      { numRuns: 100 }
    );
  });

  it('should include risk level in getConfirmationDetails', () => {
    fc.assert(
      fc.property(
        toolNameArb,
        riskLevelArb,
        fc.string({ minLength: 1, maxLength: 50 }),
        fc.array(fc.string({ minLength: 1, maxLength: 30 }), { minLength: 0, maxLength: 5 }),
        (toolName, expectedRisk, description, locations) => {
          const config: PolicyConfig = {
            defaultAction: 'ask',
            rules: [{ tool: toolName, action: 'ask', risk: expectedRisk }],
          };
          const engine = new PolicyEngine(config);

          const details = engine.getConfirmationDetails(toolName, description, locations);

          // Confirmation details should include the risk level
          expect(validRiskLevels).toContain(details.risk);
          expect(details.risk).toBe(expectedRisk);
          return true;
        }
      ),
      { numRuns: 100 }
    );
  });

  it('should consistently return the same risk level for the same tool', () => {
    fc.assert(
      fc.property(
        toolNameArb,
        fc.integer({ min: 2, max: 10 }),
        (toolName, numCalls) => {
          const engine = new PolicyEngine();

          // Call getRiskLevel multiple times
          const riskLevels = Array.from({ length: numCalls }, () => engine.getRiskLevel(toolName));

          // All calls should return the same risk level
          const firstRisk = riskLevels[0];
          expect(riskLevels.every((r) => r === firstRisk)).toBe(true);
          return true;
        }
      ),
      { numRuns: 100 }
    );
  });
});


describe('Property 37: Confirmation Details Completeness', () => {
  // Feature: stage-03-tools-policy, Property 37: Confirmation Details Completeness
  // *For any* tool requiring confirmation, the confirmation details should include
  // the tool name, description, risk level, and affected locations.
  // **Validates: Requirements 7.8**

  // Generator for valid tool names (must start with a letter)
  const toolNameArb = fc
    .stringOf(fc.constantFrom('a', 'b', 'c', 'd', 'e', 'f', 'g', 'h', 'i', 'j', 'k', 'l', 'm', 'n', 'o', 'p', 'q', 'r', 's', 't', 'u', 'v', 'w', 'x', 'y', 'z', '_', '-', '1', '2', '3'), {
      minLength: 1,
      maxLength: 30,
    })
    .filter((s) => /^[a-z]/.test(s));

  // Generator for non-empty descriptions
  const descriptionArb = fc.string({ minLength: 1, maxLength: 100 });

  // Generator for file path locations
  const locationArb = fc.string({ minLength: 1, maxLength: 50 }).filter((s) => s.trim().length > 0);

  // Generator for arrays of locations
  const locationsArb = fc.array(locationArb, { minLength: 0, maxLength: 10 });

  // Generator for risk levels
  const riskLevelArb = fc.constantFrom<'low' | 'medium' | 'high'>('low', 'medium', 'high');

  // Valid risk levels
  const validRiskLevels = ['low', 'medium', 'high'];

  it('should always include toolName in confirmation details', () => {
    fc.assert(
      fc.property(
        toolNameArb,
        descriptionArb,
        locationsArb,
        (toolName, description, locations) => {
          const engine = new PolicyEngine();
          const details = engine.getConfirmationDetails(toolName, description, locations);

          // toolName must be present and match the input
          expect(details.toolName).toBeDefined();
          expect(typeof details.toolName).toBe('string');
          expect(details.toolName).toBe(toolName);
          return true;
        }
      ),
      { numRuns: 100 }
    );
  });

  it('should always include description in confirmation details', () => {
    fc.assert(
      fc.property(
        toolNameArb,
        descriptionArb,
        locationsArb,
        (toolName, description, locations) => {
          const engine = new PolicyEngine();
          const details = engine.getConfirmationDetails(toolName, description, locations);

          // description must be present and match the input
          expect(details.description).toBeDefined();
          expect(typeof details.description).toBe('string');
          expect(details.description).toBe(description);
          return true;
        }
      ),
      { numRuns: 100 }
    );
  });

  it('should always include a valid risk level in confirmation details', () => {
    fc.assert(
      fc.property(
        toolNameArb,
        descriptionArb,
        locationsArb,
        (toolName, description, locations) => {
          const engine = new PolicyEngine();
          const details = engine.getConfirmationDetails(toolName, description, locations);

          // risk must be present and be a valid risk level
          expect(details.risk).toBeDefined();
          expect(validRiskLevels).toContain(details.risk);
          return true;
        }
      ),
      { numRuns: 100 }
    );
  });

  it('should include locations in confirmation details when provided', () => {
    fc.assert(
      fc.property(
        toolNameArb,
        descriptionArb,
        locationsArb.filter((locs) => locs.length > 0),
        (toolName, description, locations) => {
          const engine = new PolicyEngine();
          const details = engine.getConfirmationDetails(toolName, description, locations);

          // locations must be present and match the input
          expect(details.locations).toBeDefined();
          expect(Array.isArray(details.locations)).toBe(true);
          expect(details.locations).toEqual(locations);
          return true;
        }
      ),
      { numRuns: 100 }
    );
  });

  it('should handle undefined locations gracefully', () => {
    fc.assert(
      fc.property(
        toolNameArb,
        descriptionArb,
        (toolName, description) => {
          const engine = new PolicyEngine();
          const details = engine.getConfirmationDetails(toolName, description, undefined);

          // All required fields should still be present
          expect(details.toolName).toBe(toolName);
          expect(details.description).toBe(description);
          expect(validRiskLevels).toContain(details.risk);
          // locations can be undefined
          expect(details.locations).toBeUndefined();
          return true;
        }
      ),
      { numRuns: 100 }
    );
  });

  it('should handle empty locations array', () => {
    fc.assert(
      fc.property(
        toolNameArb,
        descriptionArb,
        (toolName, description) => {
          const engine = new PolicyEngine();
          const details = engine.getConfirmationDetails(toolName, description, []);

          // All required fields should still be present
          expect(details.toolName).toBe(toolName);
          expect(details.description).toBe(description);
          expect(validRiskLevels).toContain(details.risk);
          expect(details.locations).toEqual([]);
          return true;
        }
      ),
      { numRuns: 100 }
    );
  });

  it('should use rule-defined risk level in confirmation details', () => {
    fc.assert(
      fc.property(
        toolNameArb,
        descriptionArb,
        locationsArb,
        riskLevelArb,
        (toolName, description, locations, expectedRisk) => {
          const config: PolicyConfig = {
            defaultAction: 'ask',
            rules: [{ tool: toolName, action: 'ask', risk: expectedRisk }],
          };
          const engine = new PolicyEngine(config);
          const details = engine.getConfirmationDetails(toolName, description, locations);

          // risk should match the rule-defined risk
          expect(details.risk).toBe(expectedRisk);
          return true;
        }
      ),
      { numRuns: 100 }
    );
  });

  it('should use inferred risk level when no rule defines risk', () => {
    fc.assert(
      fc.property(
        toolNameArb,
        descriptionArb,
        locationsArb,
        (toolName, description, locations) => {
          const config: PolicyConfig = {
            defaultAction: 'ask',
            rules: [], // No rules, so risk is inferred
          };
          const engine = new PolicyEngine(config);
          const details = engine.getConfirmationDetails(toolName, description, locations);

          // risk should be inferred and be a valid risk level
          expect(validRiskLevels).toContain(details.risk);
          return true;
        }
      ),
      { numRuns: 100 }
    );
  });

  it('should return complete confirmation details for all tool types', () => {
    // Test with known tool types that have different inferred risk levels
    const knownTools = [
      { name: 'read_file', expectedRisk: 'low' },
      { name: 'write_file', expectedRisk: 'medium' },
      { name: 'edit_file', expectedRisk: 'medium' },
      { name: 'shell', expectedRisk: 'high' },
      { name: 'ls', expectedRisk: 'low' },
      { name: 'glob', expectedRisk: 'low' },
      { name: 'grep', expectedRisk: 'low' },
      { name: 'web_fetch', expectedRisk: 'low' },
    ];

    fc.assert(
      fc.property(
        fc.constantFrom(...knownTools),
        descriptionArb,
        locationsArb,
        (toolInfo, description, locations) => {
          const engine = new PolicyEngine({
            defaultAction: 'ask',
            rules: [], // No rules, so risk is inferred
          });
          const details = engine.getConfirmationDetails(toolInfo.name, description, locations);

          // All fields should be complete
          expect(details.toolName).toBe(toolInfo.name);
          expect(details.description).toBe(description);
          expect(details.risk).toBe(toolInfo.expectedRisk);
          if (locations.length > 0) {
            expect(details.locations).toEqual(locations);
          }
          return true;
        }
      ),
      { numRuns: 100 }
    );
  });

  it('should preserve all location paths exactly as provided', () => {
    fc.assert(
      fc.property(
        toolNameArb,
        descriptionArb,
        locationsArb,
        (toolName, description, locations) => {
          const engine = new PolicyEngine();
          const details = engine.getConfirmationDetails(toolName, description, locations);

          // Each location should be preserved exactly
          if (locations.length > 0) {
            expect(details.locations).toBeDefined();
            expect(details.locations?.length).toBe(locations.length);
            locations.forEach((loc, index) => {
              expect(details.locations?.[index]).toBe(loc);
            });
          }
          return true;
        }
      ),
      { numRuns: 100 }
    );
  });

  it('should return confirmation details that conform to ToolCallConfirmationDetails interface', () => {
    fc.assert(
      fc.property(
        toolNameArb,
        descriptionArb,
        locationsArb,
        (toolName, description, locations) => {
          const engine = new PolicyEngine();
          const details = engine.getConfirmationDetails(toolName, description, locations);

          // Verify the structure matches ToolCallConfirmationDetails
          expect(typeof details.toolName).toBe('string');
          expect(typeof details.description).toBe('string');
          expect(['low', 'medium', 'high']).toContain(details.risk);
          if (details.locations !== undefined) {
            expect(Array.isArray(details.locations)).toBe(true);
            details.locations.forEach((loc) => {
              expect(typeof loc).toBe('string');
            });
          }
          return true;
        }
      ),
      { numRuns: 100 }
    );
  });
});
