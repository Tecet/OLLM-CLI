import React from 'react';
import { render } from 'ink-testing-library';
import { describe, it, expect } from 'vitest';
import { HealthIndicator, formatUptime } from '../HealthIndicator';

describe('HealthIndicator', () => {
  describe('status display', () => {
    it('should render healthy status with green color and ● icon', () => {
      const { lastFrame } = render(<HealthIndicator status="healthy" />);
      expect(lastFrame()).toContain('●');
      expect(lastFrame()).toContain('healthy');
    });

    it('should render degraded status with yellow color and ⚠ icon', () => {
      const { lastFrame } = render(<HealthIndicator status="degraded" />);
      expect(lastFrame()).toContain('⚠');
      expect(lastFrame()).toContain('degraded');
    });

    it('should render unhealthy status with red color and ✗ icon', () => {
      const { lastFrame } = render(<HealthIndicator status="unhealthy" />);
      expect(lastFrame()).toContain('✗');
      expect(lastFrame()).toContain('unhealthy');
    });

    it('should render stopped status with gray color and ○ icon', () => {
      const { lastFrame } = render(<HealthIndicator status="stopped" />);
      expect(lastFrame()).toContain('○');
      expect(lastFrame()).toContain('stopped');
    });

    it('should render connecting status with blue color and ⟳ icon', () => {
      const { lastFrame } = render(<HealthIndicator status="connecting" />);
      expect(lastFrame()).toContain('⟳');
      expect(lastFrame()).toContain('connecting');
    });
  });

  describe('uptime display', () => {
    it('should not show uptime by default', () => {
      const { lastFrame } = render(<HealthIndicator status="healthy" uptime={3600} />);
      expect(lastFrame()).not.toContain('1h');
    });

    it('should show uptime when showUptime is true', () => {
      const { lastFrame } = render(
        <HealthIndicator status="healthy" uptime={3600} showUptime={true} />
      );
      expect(lastFrame()).toContain('1h');
    });

    it('should not show uptime when uptime is 0', () => {
      const { lastFrame } = render(
        <HealthIndicator status="healthy" uptime={0} showUptime={true} />
      );
      expect(lastFrame()).not.toContain('(');
    });

    it('should not show uptime when uptime is undefined', () => {
      const { lastFrame } = render(
        <HealthIndicator status="healthy" showUptime={true} />
      );
      expect(lastFrame()).not.toContain('(');
    });
  });
});

describe('formatUptime', () => {
  it('should format seconds only', () => {
    expect(formatUptime(30)).toBe('30s');
    expect(formatUptime(59)).toBe('59s');
  });

  it('should format minutes and seconds', () => {
    expect(formatUptime(90)).toBe('1m 30s');
    expect(formatUptime(150)).toBe('2m 30s');
  });

  it('should format minutes only when seconds are 0', () => {
    expect(formatUptime(60)).toBe('1m');
    expect(formatUptime(120)).toBe('2m');
  });

  it('should format hours and minutes', () => {
    expect(formatUptime(3600)).toBe('1h');
    expect(formatUptime(3660)).toBe('1h 1m');
    expect(formatUptime(5400)).toBe('1h 30m');
    expect(formatUptime(7200)).toBe('2h');
  });

  it('should format hours only when minutes are 0', () => {
    expect(formatUptime(3600)).toBe('1h');
    expect(formatUptime(7200)).toBe('2h');
  });

  it('should handle large uptimes', () => {
    expect(formatUptime(86400)).toBe('24h');
    expect(formatUptime(90000)).toBe('25h');
  });

  it('should handle zero uptime', () => {
    expect(formatUptime(0)).toBe('0s');
  });

  it('should handle negative uptime', () => {
    expect(formatUptime(-100)).toBe('0s');
  });
});
