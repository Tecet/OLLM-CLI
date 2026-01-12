/**
 * VRAM Monitor Service
 * 
 * Monitors GPU memory availability and emits low-memory events.
 * Supports NVIDIA, AMD, Apple Silicon, and falls back to system RAM for CPU-only mode.
 */

import { exec } from 'child_process';
import { promisify } from 'util';
import { totalmem, freemem } from 'os';
import { EventEmitter } from 'events';
import { VRAMMonitor, VRAMInfo, GPUType, GPUDetector } from './types.js';
import { createGPUDetector } from './gpuDetector.js';

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
        console.error('VRAM monitoring error:', error);
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
      console.warn('Failed to query NVIDIA GPU memory, falling back to system RAM:', error);
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
      console.warn('Failed to query AMD GPU memory, falling back to system RAM:', error);
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
      console.warn('Failed to query Apple Silicon memory, falling back to system RAM:', error);
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

  /**
   * Set low memory threshold (for testing)
   */
  setLowMemoryThreshold(threshold: number): void {
    this.lowMemoryThreshold = Math.max(0, Math.min(1, threshold));
  }

  /**
   * Clear cached GPU type (for testing)
   */
  clearCache(): void {
    this.gpuType = null;
  }
}

/**
 * Create a new VRAM monitor instance
 */
export function createVRAMMonitor(gpuDetector?: GPUDetector): VRAMMonitor {
  return new DefaultVRAMMonitor(gpuDetector);
}
