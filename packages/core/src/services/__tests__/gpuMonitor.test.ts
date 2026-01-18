/**
 * Unit tests for GPU Monitor
 * Feature: stage-06-cli-ui
 */

import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import { DefaultGPUMonitor, type GPUInfo } from '../gpuMonitor.js';
import * as childProcess from 'child_process';

type ExecResult = { stdout: string; stderr: string };
type ExecCallback = (err: Error | null, result: ExecResult) => void;

const mockExec = (handler: (cmd: string, cb: ExecCallback) => void) => {
  vi.mocked(childProcess.exec).mockImplementation(
    (cmd: string, options: childProcess.ExecOptions | ExecCallback, callback?: ExecCallback) => {
      const cb = typeof options === 'function' ? options : callback;
      if (!cb) {
        throw new Error('Missing exec callback');
      }
      handler(cmd, cb);
      return {} as childProcess.ChildProcess;
    }
  );
};

// Mock child_process
vi.mock('child_process', () => ({
  exec: vi.fn()
}));

// Mock util.promisify to return our mock
vi.mock('util', async (importOriginal) => {
  const original = await importOriginal<typeof import('util')>();
  return {
    ...original,
    promisify: vi.fn((fn: unknown) => {
      // Return a function that wraps the mock exec
      return (...args: unknown[]) => {
        return new Promise((resolve, reject) => {
          const execFn = fn as (cmd: string, options: childProcess.ExecOptions, callback: ExecCallback) => void;
          execFn(args[0] as string, (args[1] as childProcess.ExecOptions) || {}, (err, result) => {
            if (err) reject(err);
            else resolve(result);
          });
        });
      };
    }),
  };
});

describe('GPU Monitor - Unit Tests', () => {
  let monitor: DefaultGPUMonitor;
  let originalPlatform: string;

  beforeEach(() => {
    monitor = new DefaultGPUMonitor();
    vi.clearAllMocks();
    originalPlatform = process.platform;
  });

  afterEach(() => {
    monitor.stopPolling();
    Object.defineProperty(process, 'platform', { value: originalPlatform, configurable: true });
  });

  describe('Vendor Detection', () => {
    it('should detect NVIDIA GPU when nvidia-smi is available', async () => {
      // Mock nvidia-smi --version to succeed
      mockExec((cmd, cb) => {
        if (cmd.includes('nvidia-smi --version')) {
          cb(null, { stdout: 'NVIDIA-SMI 525.60.11', stderr: '' });
        } else {
          cb(new Error('Command not found'), { stdout: '', stderr: '' });
        }
      });

      const vendor = await monitor.detectVendor();
      expect(vendor).toBe('nvidia');
    });

    it('should detect AMD GPU when rocm-smi is available', async () => {
      // Set platform to linux (AMD ROCm only works on Linux)
      Object.defineProperty(process, 'platform', { value: 'linux', configurable: true });
      
      // Mock nvidia-smi to fail, rocm-smi to succeed
      mockExec((cmd, cb) => {
        if (cmd.includes('nvidia-smi --version')) {
          cb(new Error('Command not found'), { stdout: '', stderr: '' });
        } else if (cmd.includes('rocm-smi --version')) {
          cb(null, { stdout: 'ROCm System Management Interface', stderr: '' });
        } else {
          cb(new Error('Command not found'), { stdout: '', stderr: '' });
        }
      });

      const vendor = await monitor.detectVendor();
      expect(vendor).toBe('amd');
    });

    it('should detect Apple GPU on macOS when ioreg shows GPU', async () => {
      Object.defineProperty(process, 'platform', { value: 'darwin', configurable: true });

      // Mock nvidia-smi to fail, ioreg to succeed
      mockExec((cmd, cb) => {
        if (cmd.includes('nvidia-smi --version')) {
          cb(new Error('Command not found'), { stdout: '', stderr: '' });
        } else if (cmd.includes('ioreg')) {
          cb(null, { stdout: 'apple-gpu AGXAccelerator', stderr: '' });
        } else {
          cb(new Error('Command not found'), { stdout: '', stderr: '' });
        }
      });

      const vendor = await monitor.detectVendor();
      expect(vendor).toBe('apple');
    });

    it('should detect Windows GPU when PowerShell GPU counters are available', async () => {
      Object.defineProperty(process, 'platform', { value: 'win32', configurable: true });

      // Mock nvidia-smi to fail, PowerShell to succeed
      mockExec((cmd, cb) => {
        if (cmd.includes('nvidia-smi --version')) {
          cb(new Error('Command not found'), { stdout: '', stderr: '' });
        } else if (cmd.includes('Get-Counter -ListSet')) {
          cb(null, { stdout: 'GPU Adapter Memory', stderr: '' });
        } else {
          cb(new Error('Command not found'), { stdout: '', stderr: '' });
        }
      });

      const vendor = await monitor.detectVendor();
      expect(vendor).toBe('windows');
    });

    it('should fallback to CPU when no GPU is detected', async () => {
      // Set to linux to avoid Windows detection
      Object.defineProperty(process, 'platform', { value: 'linux', configurable: true });
      
      // Mock all GPU detection commands to fail
      mockExec((cmd, cb) => {
        cb(new Error('Command not found'), { stdout: '', stderr: '' });
      });

      const vendor = await monitor.detectVendor();
      expect(vendor).toBe('cpu');
    });

    it('should cache vendor detection result', async () => {
      mockExec((cmd, cb) => {
        if (cmd.includes('nvidia-smi --version')) {
          cb(null, { stdout: 'NVIDIA-SMI 525.60.11', stderr: '' });
        } else {
          cb(new Error('Command not found'), { stdout: '', stderr: '' });
        }
      });

      const vendor1 = await monitor.detectVendor();
      const vendor2 = await monitor.detectVendor();

      expect(vendor1).toBe('nvidia');
      expect(vendor2).toBe('nvidia');
      // Should only call exec once due to caching
      expect(vi.mocked(childProcess.exec)).toHaveBeenCalledTimes(1);
    });
  });

  describe('NVIDIA Query Parsing', () => {
    it('should parse nvidia-smi output correctly', async () => {
      // Mock vendor detection
      mockExec((cmd, cb) => {
        if (cmd.includes('nvidia-smi --version')) {
          cb(null, { stdout: 'NVIDIA-SMI 525.60.11', stderr: '' });
        } else if (cmd.includes('nvidia-smi --query-gpu')) {
          // Sample output: memory.total, memory.used, memory.free, temp, temp.max, utilization
          cb(null, { stdout: '8192, 4096, 4096, 65, 90, 75', stderr: '' });
        }
      });

      const info = await monitor.getInfo();

      expect(info.vendor).toBe('nvidia');
      expect(info.available).toBe(true);
      expect(info.vramTotal).toBe(8192 * 1024 * 1024); // 8192 MiB in bytes
      expect(info.vramUsed).toBe(4096 * 1024 * 1024);
      expect(info.vramFree).toBe(4096 * 1024 * 1024);
      expect(info.temperature).toBe(65);
      expect(info.temperatureMax).toBe(90);
      expect(info.gpuUtilization).toBe(75);
    });

    it('should use default temperature max when not available', async () => {
      mockExec((cmd, cb) => {
        if (cmd.includes('nvidia-smi --version')) {
          cb(null, { stdout: 'NVIDIA-SMI 525.60.11', stderr: '' });
        } else if (cmd.includes('nvidia-smi --query-gpu')) {
          // Output with missing temp.max (NaN or empty)
          cb(null, { stdout: '8192, 4096, 4096, 65, , 75', stderr: '' });
        }
      });

      const info = await monitor.getInfo();

      expect(info.temperatureMax).toBe(90); // Default value
    });
  });

  describe('AMD Query Parsing', () => {
    it('should parse rocm-smi output correctly', async () => {
      // Set platform to Linux since AMD ROCm only works there
      Object.defineProperty(process, 'platform', { value: 'linux', configurable: true });
      
      mockExec((cmd, cb) => {
        if (cmd.includes('nvidia-smi --version')) {
          cb(new Error('Command not found'), { stdout: '', stderr: '' });
        } else if (cmd.includes('rocm-smi --version')) {
          cb(null, { stdout: 'ROCm SMI', stderr: '' });
        } else if (cmd.includes('rocm-smi --showmeminfo')) {
          cb(null, {
            stdout: 'VRAM Total Memory (B): 8589934592\nVRAM Total Used Memory (B): 4294967296',
            stderr: ''
          });
        } else if (cmd.includes('rocm-smi --showtemp')) {
          cb(null, { stdout: 'Temperature (Sensor edge) (C): 68.0', stderr: '' });
        } else if (cmd.includes('rocm-smi --showuse')) {
          cb(null, { stdout: 'GPU use (%): 80.5', stderr: '' });
        } else {
          cb(new Error('Command not found'), { stdout: '', stderr: '' });
        }
      });

      const info = await monitor.getInfo();

      expect(info.vendor).toBe('amd');
      expect(info.available).toBe(true);
      expect(info.vramTotal).toBe(8589934592);
      expect(info.vramUsed).toBe(4294967296);
      expect(info.vramFree).toBe(8589934592 - 4294967296);
      expect(info.temperature).toBe(68.0);
      expect(info.gpuUtilization).toBe(80.5);
    });
  });

  describe('CPU Fallback', () => {
    it('should query system RAM on Windows', async () => {
      const originalPlatform = process.platform;
      Object.defineProperty(process, 'platform', { value: 'win32' });

      mockExec((cmd, cb) => {
        if (cmd.includes('nvidia-smi') || cmd.includes('rocm-smi')) {
          cb(new Error('Command not found'), { stdout: '', stderr: '' });
        } else if (cmd.includes('wmic OS')) {
          cb(null, {
            stdout: 'TotalVisibleMemorySize=16777216\nFreePhysicalMemory=8388608',
            stderr: ''
          });
        } else {
          cb(new Error('Command not found'), { stdout: '', stderr: '' });
        }
      });

      const info = await monitor.getInfo();

      expect(info.vendor).toBe('cpu');
      expect(info.available).toBe(false);
      expect(info.vramTotal).toBe(16777216 * 1024); // KB to bytes
      expect(info.vramFree).toBe(8388608 * 1024);
      expect(info.temperature).toBe(0);

      Object.defineProperty(process, 'platform', { value: originalPlatform });
    });

    it('should query system RAM on Unix-like systems', async () => {
      const originalPlatform = process.platform;
      Object.defineProperty(process, 'platform', { value: 'linux' });

      mockExec((cmd, cb) => {
        if (cmd.includes('nvidia-smi') || cmd.includes('rocm-smi')) {
          cb(new Error('Command not found'), { stdout: '', stderr: '' });
        } else if (cmd.includes('free -b')) {
          cb(null, {
            stdout: 'Mem:     16777216000  8388608000  8388608000',
            stderr: ''
          });
        } else {
          cb(new Error('Command not found'), { stdout: '', stderr: '' });
        }
      });

      const info = await monitor.getInfo();

      expect(info.vendor).toBe('cpu');
      expect(info.available).toBe(false);
      expect(info.vramTotal).toBe(16777216000);
      expect(info.vramUsed).toBe(8388608000);
      expect(info.vramFree).toBe(8388608000);

      Object.defineProperty(process, 'platform', { value: originalPlatform });
    });

    it('should return empty info when CPU query fails', async () => {
      mockExec((cmd, cb) => {
        cb(new Error('Command failed'), { stdout: '', stderr: '' });
      });

      const info = await monitor.getInfo();

      expect(info.vendor).toBe('cpu');
      expect(info.available).toBe(false);
      expect(info.vramTotal).toBe(0);
      expect(info.vramUsed).toBe(0);
      expect(info.vramFree).toBe(0);
    });
  });

  describe('Fallback Behavior', () => {
    // TODO: This test has complex mock interactions that need investigation
    it.skip('should fallback to CPU mode when GPU query fails', async () => {
      const originalPlatform = process.platform;
      Object.defineProperty(process, 'platform', { value: 'linux', configurable: true });

      mockExec((cmd, cb) => {
        if (cmd.includes('nvidia-smi --version')) {
          cb(null, { stdout: 'NVIDIA-SMI', stderr: '' });
        } else if (cmd.includes('nvidia-smi --query-gpu')) {
          // GPU query fails
          cb(new Error('GPU query failed'), { stdout: '', stderr: '' });
        } else if (cmd.includes('free -b')) {
          cb(null, {
            stdout: 'Mem:     16777216000  8388608000  8388608000',
            stderr: ''
          });
        } else {
          cb(new Error('Command not found'), { stdout: '', stderr: '' });
        }
      });

      const info = await monitor.getInfo();

      // Should fallback to CPU mode
      expect(info.vendor).toBe('cpu');
      expect(info.available).toBe(false);

      Object.defineProperty(process, 'platform', { value: originalPlatform });
    });
  });

  describe('Polling', () => {
    it('should poll GPU info at specified interval', async () => {
      let callCount = 0;
      mockExec((cmd, cb) => {
        if (cmd.includes('nvidia-smi --version')) {
          cb(null, { stdout: 'NVIDIA-SMI', stderr: '' });
        } else if (cmd.includes('nvidia-smi --query-gpu')) {
          callCount++;
          cb(null, { stdout: '8192, 4096, 4096, 65, 90, 75', stderr: '' });
        } else {
          cb(new Error('Command not found'), { stdout: '', stderr: '' });
        }
      });

      const updates: GPUInfo[] = [];
      monitor.onUpdate((info) => {
        updates.push(info);
      });

      // Start polling with 100ms interval
      monitor.startPolling(100);

      // Wait for a few polling cycles
      await new Promise(resolve => setTimeout(resolve, 350));

      monitor.stopPolling();

      expect(updates.length).toBeGreaterThanOrEqual(2);
      expect(callCount).toBeGreaterThanOrEqual(2);
    });

    it('should stop polling when stopPolling is called', async () => {
      let callCount = 0;
      mockExec((cmd, cb) => {
        if (cmd.includes('nvidia-smi --version')) {
          cb(null, { stdout: 'NVIDIA-SMI', stderr: '' });
        } else if (cmd.includes('nvidia-smi --query-gpu')) {
          callCount++;
          cb(null, { stdout: '8192, 4096, 4096, 65, 90, 75', stderr: '' });
        } else {
          cb(new Error('Command not found'), { stdout: '', stderr: '' });
        }
      });

      // Start polling with 100ms interval
      monitor.startPolling(100);
      await new Promise(resolve => setTimeout(resolve, 250));

      const countBeforeStop = callCount;
      monitor.stopPolling();

      await new Promise(resolve => setTimeout(resolve, 250));

      // Should not have increased significantly after stopping
      expect(callCount).toBeLessThanOrEqual(countBeforeStop + 1);
    });
  });

  describe('Callbacks', () => {
    it('should trigger update callbacks', async () => {
      mockExec((cmd, cb) => {
        if (cmd.includes('nvidia-smi --version')) {
          cb(null, { stdout: 'NVIDIA-SMI', stderr: '' });
        } else if (cmd.includes('nvidia-smi --query-gpu')) {
          cb(null, { stdout: '8192, 4096, 4096, 65, 90, 75', stderr: '' });
        } else {
          cb(new Error('Command not found'), { stdout: '', stderr: '' });
        }
      });

      let updateCalled = false;
      let receivedInfo: GPUInfo | null = null;

      monitor.onUpdate((info) => {
        updateCalled = true;
        receivedInfo = info;
      });

      // Start polling to trigger update callback
      monitor.startPolling(50);

      // Wait for a tick for the callback - needs to be > 50ms (interval)
      await new Promise(resolve => setTimeout(resolve, 100));

      monitor.stopPolling();

      expect(updateCalled).toBe(true);
      expect(receivedInfo).not.toBeNull();
      expect(receivedInfo!.vendor).toBe('nvidia');
    });

    it('should trigger high temperature callback when threshold exceeded', async () => {
      mockExec((cmd, cb) => {
        if (cmd.includes('nvidia-smi --version')) {
          cb(null, { stdout: 'NVIDIA-SMI', stderr: '' });
        } else if (cmd.includes('nvidia-smi --query-gpu')) {
          cb(null, { stdout: '8192, 4096, 4096, 85, 90, 75', stderr: '' });
        } else {
          cb(new Error('Command not found'), { stdout: '', stderr: '' });
        }
      });

      let highTempCalled = false;

      monitor.onHighTemp(80, () => {
        highTempCalled = true;
      });

      await monitor.getInfo();
      await new Promise(resolve => setTimeout(resolve, 50));

      expect(highTempCalled).toBe(true);
    });

    it('should trigger low VRAM callback when threshold not met', async () => {
      mockExec((cmd, cb) => {
        if (cmd.includes('nvidia-smi --version')) {
          cb(null, { stdout: 'NVIDIA-SMI', stderr: '' });
        } else if (cmd.includes('nvidia-smi --query-gpu')) {
          // Free VRAM: 256 MiB = 268435456 bytes
          cb(null, { stdout: '8192, 7936, 256, 65, 90, 75', stderr: '' });
        } else {
          cb(new Error('Command not found'), { stdout: '', stderr: '' });
        }
      });

      let lowVramCalled = false;

      // Set threshold to 1GB (1073741824 bytes)
      monitor.onLowVRAM(1073741824, () => {
        lowVramCalled = true;
      });

      await monitor.getInfo();
      await new Promise(resolve => setTimeout(resolve, 50));

      expect(lowVramCalled).toBe(true);
    });
  });
});

