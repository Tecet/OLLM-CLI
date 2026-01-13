import { describe, it, expect } from 'vitest';
import { homeCommand } from '../homeCommand.js';

describe('homeCommand', () => {
  it('should have correct name', () => {
    expect(homeCommand.name).toBe('/home');
  });

  it('should have description', () => {
    expect(homeCommand.description).toBeTruthy();
  });

  it('should return success with show-launch-screen action', async () => {
    const result = await homeCommand.handler([]);
    
    expect(result.success).toBe(true);
    expect(result.action).toBe('show-launch-screen');
  });

  it('should include message', async () => {
    const result = await homeCommand.handler([]);
    
    expect(result.message).toBeTruthy();
    expect(result.message).toContain('launch screen');
  });
});
