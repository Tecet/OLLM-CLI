/**
 * Reproduction test for flaky HooksContext idempotency failure
 * Runs the specific counterexample (hookId='A', initialState=false)
 * and logs state transitions and mocked SettingsService calls.
 */

import { it, expect, vi } from 'vitest';
import React from 'react';
import { render } from 'ink-testing-library';
import { HooksProvider, useHooks } from '../HooksContext.js';
import { HookRegistry } from '@ollm/ollm-cli-core/hooks/hookRegistry.js';
import type { Hook } from '@ollm/ollm-cli-core/hooks/types.js';
import { SettingsService } from '../../../config/settingsService.js';
import { Text } from 'ink';

// Use same SettingsService mock as property tests
vi.mock('../../../config/settingsService.js', () => {
  const mockSettings = {
    hooks: {
      enabled: {} as Record<string, boolean>,
    },
  };

  return {
    SettingsService: {
      getInstance: vi.fn(() => ({
        getHookSettings: vi.fn(() => mockSettings.hooks),
        setHookEnabled: vi.fn((hookId: string, enabled: boolean) => {
          mockSettings.hooks.enabled[hookId] = enabled;
        }),
        removeHookSetting: vi.fn((hookId: string) => {
          delete mockSettings.hooks.enabled[hookId];
        }),
      })),
    },
  };
});

const TestComponent = ({ onRender }: { onRender: (value: ReturnType<typeof useHooks>) => void }) => {
  const hooks = useHooks();
  React.useEffect(() => onRender(hooks), [hooks, onRender]);
  return <Text>repro</Text>;
};

it('reproduces idempotency counterexample (hookId=A, initialState=false)', async () => {
  const hookId = 'A';
  const initialState = false;

  const testRegistry = new HookRegistry();
  const testSettings = SettingsService.getInstance();

  const testHook: Hook = {
    id: hookId,
    name: `Test Hook ${hookId}`,
    command: 'echo test',
    source: 'user',
  };

  testRegistry.registerHook('session_start', testHook);

  // Set initial state
  vi.mocked(testSettings.getHookSettings).mockReturnValue({ enabled: { [hookId]: initialState } });

  let captured: ReturnType<typeof useHooks> | null = null;

  render(
    <HooksProvider hookRegistry={testRegistry} settingsService={testSettings}>
      <TestComponent onRender={(v) => { captured = v; }} />
    </HooksProvider>
  );

  // helper to poll until ready
  const waitForReady = async (timeout = 1000) => {
    const start = Date.now();
    while ((captured === null || captured.state.isLoading) && Date.now() - start < timeout) {
      await new Promise(r => setTimeout(r, 10));
    }
    if (captured === null) throw new Error('captured null');
    if (captured.state.isLoading) throw new Error('still loading');
  };

  await waitForReady(1000);

  console.log('initial enabled:', captured!.isHookEnabled(hookId));

  // Spy on setHookEnabled calls
  const setSpy = testSettings.setHookEnabled as unknown as any;

  // Toggle once
  await captured!.toggleHook(hookId);
  // wait for state change
  await new Promise(r => setTimeout(r, 50));
  console.log('after 1 toggle enabled:', captured!.isHookEnabled(hookId));
  console.log('setHookEnabled calls after 1:', setSpy.mock?.calls || setSpy.calls || []);

  // Toggle second time
  await captured!.toggleHook(hookId);
  await new Promise(r => setTimeout(r, 50));
  console.log('after 2 toggles enabled:', captured!.isHookEnabled(hookId));
  console.log('setHookEnabled calls after 2:', setSpy.mock?.calls || setSpy.calls || []);

  // Assertions for expected behavior (will fail if reproduction shows issue)
  expect(captured!.isHookEnabled(hookId)).toBe(initialState);
  expect(testSettings.setHookEnabled).toHaveBeenCalledTimes(2);
});
