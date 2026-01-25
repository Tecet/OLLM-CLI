/**
 * VRAM Monitor Service
 * 
 * Monitors GPU memory availability and emits low-memory events.
 * Supports NVIDIA, AMD, Apple Silicon, and falls back to system RAM for CPU-only mode.
 */

import { exec } from 'child_process';
import { EventEmitter } from 'events';
import { totalmem, freemem } from 'os';
import { promisify } from 'util';

import { createGPUDetector } from './gpuDetector.js';
import { VRAMMonitor, VRAMInfo, GPUType, GPUDetector } from './types.js';
import { createLogger } from '../utils/logger.js';

const logger = createLogger('vramMonitor');

const execAsync = promisify(exec);

/**
 * Default VRAM Monitor implementation
 */
export class DefaultVRAMMonitor extends EventEmitter implements VRAMMonitor {
  private gpuDetector: GPUDetector;
  private gpuType: GPUType | null = null;
  private monitoringInterval: NodeJS.Timeout | null = null;
  private lowMemoryThreshold: number = 0.2; // 20% of total
  private lastLowMemoryEmit: number = 0;
  private lowMemoryEmitCooldown: number = 30000; // 30 seconds

  constructor(gpuDetector?: GPUDetector, lowMemoryThreshold?: number) {
    super();
    this.gpuDetector = gpuDetector || createGPUDetector();
    if (lowMemoryThreshold !== undefined) {
      this.lowMemoryThreshold = lowMemoryThreshold;
    }
  }

  /**
   * Query current memory status
   */
  async getInfo(): Promise<VRAMInfo> {
    // In test environment, skip hardware checks and return system memory
    if (process.env.NODE_ENV === 'test' || process.env.VITEST_WORKER_ID) {
      return await this.getSystemMemory();
    }

    // Detect GPU type if not cached
    if (this.gpuType === null) {
      this.gpuType = await this.gpuDetector.detectGPU();
    }

    // Query memory based on GPU type
    switch (this.gpuType) {
      case GPUType.NVIDIA:
        return await this.getNVIDIAMemory();
      case GPUType.AMD:
        return await this.getAMDMemory();
      case GPUType.APPLE_SILICON:
        return await this.getAppleMemory();
      case GPUType.WINDOWS:
        return await this.getWindowsGPUMemory();
      case GPUType.CPU_ONLY:
      default:
        return await this.getSystemMemory();
    }
  }

  /**
   * Get memory available for context allocation
   */
  async getAvailableForContext(): Promise<number> {
    const info = await this.getInfo();
    // Reserve some memory for model operations and overhead
    const reservedMemory = Math.min(info.modelLoaded * 0.1, 512 * 1024 * 1024); // 10% of model or 512MB
    return Math.max(0, info.available - reservedMemory);
  }

  /**
   * Register callback for low memory events
   */
  onLowMemory(callback: (info: VRAMInfo) => void): void {
    this.on('low-memory', callback);
  }

  /**
   * Set the low memory threshold (for testing)
   */
  setLowMemoryThreshold(threshold: number): void {
    this.lowMemoryThreshold = threshold;
  }

  /**
   * Reset the low memory emit cooldown (for testing)
   */
  resetCooldown(): void {
    this.lastLowMemoryEmit = 0;
  }

  /**
   * Clear cached GPU type (for testing)
   */
  clearCache(): void {
    this.gpuType = null;
  }

  /**
   * Start monitoring with specified interval
   */
  startMonitoring(intervalMs: number = 5000): void {
    // Stop existing monitoring if any
    this.stopMonitoring();

    // Start new monitoring interval
    this.monitoringInterval = setInterval(async () => {
      try {
        const info = await this.getInfo();
        
        // Check if memory is low
        if (info.available < info.total * this.lowMemoryThreshold) {
          // Emit event with cooldown to avoid spam
          const now = Date.now();
          if (now - this.lastLowMemoryEmit > this.lowMemoryEmitCooldown) {
            this.emit('low-memory', info);
            this.lastLowMemoryEmit = now;
          }
        }
      } catch (error) {
        // Log error but don't stop monitoring
        logger.error('VRAM monitoring error:', { error });
      }
    }, intervalMs);
  }

  /**
   * Stop monitoring
   */
  stopMonitoring(): void {
    if (this.monitoringInterval !== null) {
      clearInterval(this.monitoringInterval);
      this.monitoringInterval = null;
    }
  }

  /**
   * Get NVIDIA GPU memory using nvidia-smi
   */
  private async getNVIDIAMemory(): Promise<VRAMInfo> {
    try {
      const { stdout } = await execAsync(
        'nvidia-smi --query-gpu=memory.total,memory.used,memory.free --format=csv,noheader,nounits',
        { timeout: 5000, windowsHide: true }
      );

      const values = stdout.trim().split(',').map(v => parseInt(v.trim(), 10));
      
      if (values.length >= 3 && values.every(v => !isNaN(v))) {
        const totalMB = values[0];
        const usedMB = values[1];
        const freeMB = values[2];

        // Convert MB to bytes
        const total = totalMB * 1024 * 1024;
        const used = usedMB * 1024 * 1024;
        const available = freeMB * 1024 * 1024;

        // Estimate model memory (rough approximation)
        const modelLoaded = Math.max(0, used - (total * 0.1)); // Assume 10% overhead

        return { total, used, available, modelLoaded };
      }
    } catch (error) {
      logger.warn('Failed to query NVIDIA GPU memory, falling back to system RAM:', { error });
    }

    // Fallback to system RAM
    return this.getSystemMemory();
  }

  /**
   * Get AMD GPU memory using rocm-smi
   */
  private async getAMDMemory(): Promise<VRAMInfo> {
    try {
      const { stdout } = await execAsync('rocm-smi --showmeminfo vram', {
        timeout: 5000
      });

      // Parse rocm-smi output
      // Format varies, but typically includes "VRAM Total Memory" and "VRAM Total Used Memory"
      const totalMatch = stdout.match(/VRAM Total Memory[:\s]+(\d+)/i);
      const usedMatch = stdout.match(/VRAM Total Used Memory[:\s]+(\d+)/i);

      if (totalMatch && usedMatch) {
        const total = parseInt(totalMatch[1], 10);
        const used = parseInt(usedMatch[1], 10);
        const available = total - used;
        const modelLoaded = Math.max(0, used - (total * 0.1));

        return { total, used, available, modelLoaded };
      }
    } catch (error) {
      logger.warn('Failed to query AMD GPU memory, falling back to system RAM:', { error });
    }

    // Fallback to system RAM
    return this.getSystemMemory();
  }

  /**
   * Get Apple Silicon memory using sysctl and vm_stat
   */
  private async getAppleMemory(): Promise<VRAMInfo> {
    try {
      // Get total memory
      const { stdout: totalOutput } = await execAsync('sysctl -n hw.memsize', {
        timeout: 5000
      });
      const total = parseInt(totalOutput.trim(), 10);

      // Get memory statistics using vm_stat
      const { stdout: vmOutput } = await execAsync('vm_stat', {
        timeout: 5000
      });

      // Parse vm_stat output
      const pageSize = 4096; // Default page size on macOS
      const freeMatch = vmOutput.match(/Pages free:\s+(\d+)/);
      const inactiveMatch = vmOutput.match(/Pages inactive:\s+(\d+)/);

      if (freeMatch && inactiveMatch) {
        const freePages = parseInt(freeMatch[1], 10);
        const inactivePages = parseInt(inactiveMatch[1], 10);
        const available = (freePages + inactivePages) * pageSize;
        const used = total - available;
        const modelLoaded = Math.max(0, used - (total * 0.2)); // Assume 20% system overhead

        return { total, used, available, modelLoaded };
      }
    } catch (error) {
      logger.warn('Failed to query Apple Silicon memory, falling back to system RAM:', { error });
    }

    // Fallback to system RAM
    return this.getSystemMemory();
  }

  /**
   * Get Windows GPU memory using PowerShell Get-Counter
   * Works with any GPU vendor (NVIDIA, AMD, Intel) on Windows
   */
  private async getWindowsGPUMemory(): Promise<VRAMInfo> {
    try {
      // Query GPU adapter memory counters using PowerShell
      const { stdout: memOutput } = await execAsync(
        `powershell -NoProfile -Command "` +
        `$counters = Get-Counter -Counter @('\\GPU Adapter Memory(*)\\Local Usage', '\\GPU Adapter Memory(*)\\Dedicated Usage', '\\GPU Adapter Memory(*)\\Shared Usage') -ErrorAction SilentlyContinue; ` +
        `if ($counters) { ` +
          `$local = ($counters.CounterSamples | Where-Object { $_.Path -like '*Local Usage' } | Measure-Object -Property CookedValue -Sum).Sum; ` +
          `$dedicated = ($counters.CounterSamples | Where-Object { $_.Path -like '*Dedicated Usage' } | Measure-Object -Property CookedValue -Sum).Sum; ` +
          `$shared = ($counters.CounterSamples | Where-Object { $_.Path -like '*Shared Usage' } | Measure-Object -Property CookedValue -Sum).Sum; ` +
          'Write-Output "$local,$dedicated,$shared" ' +
        `} else { Write-Output '0,0,0' }"`,
        { timeout: 10000, windowsHide: true }
      );

      // Parse memory values (they come in bytes)
      const memValues = memOutput.trim().split(',').map(v => parseInt(v.trim(), 10) || 0);
      const localUsage = memValues[0] || 0;
      const dedicatedUsage = memValues[1] || 0;
      
      // Calculate VRAM metrics
      const used = localUsage + dedicatedUsage;
      
      // Query total dedicated memory from registry (more accurate)
      let total = 0;
      try {
        const { stdout: regOutput } = await execAsync(
          `powershell -NoProfile -Command "` +
          `Get-ItemProperty -Path 'HKLM:\\SYSTEM\\ControlSet001\\Control\\Class\\{4d36e968-e325-11ce-bfc1-08002be10318}\\0*' -ErrorAction SilentlyContinue | ` +
          `ForEach-Object { if ($_.'HardwareInformation.qwMemorySize') { $_.'HardwareInformation.qwMemorySize' } } | ` +
          `Measure-Object -Maximum | Select-Object -ExpandProperty Maximum"`,
          { timeout: 5000, windowsHide: true }
        );
        total = parseInt(regOutput.trim(), 10) || 0;
      } catch {
        // If registry query fails, estimate from used memory
        total = Math.max(used * 2, 4 * 1024 * 1024 * 1024); // Estimate or default to 4GB
      }

      const available = Math.max(0, total - used);
      const modelLoaded = Math.max(0, used - (total * 0.1)); // Assume 10% overhead

      return { total, used, available, modelLoaded };
    } catch (error) {
      logger.warn('Failed to query Windows GPU memory, falling back to system RAM:', { error });
    }

    // Fallback to system RAM
    return this.getSystemMemory();
  }

  /**
   * Get system RAM as fallback for CPU-only mode
   */
  private async getSystemMemory(): Promise<VRAMInfo> {
    const total = totalmem();
    const available = freemem();
    const used = total - available;
    
    // For CPU-only, we don't have a good way to estimate model memory
    // Assume model uses about 30% of used memory (rough heuristic)
    const modelLoaded = Math.floor(used * 0.3);

    return { total, used, available, modelLoaded };
  }

}

/**
 * Create a new VRAM monitor instance
 */
export function createVRAMMonitor(gpuDetector?: GPUDetector): VRAMMonitor {
  return new DefaultVRAMMonitor(gpuDetector);
}
