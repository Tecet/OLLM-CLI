/**
 * GPU Detection Service
 * 
 * Detects GPU type on the system (NVIDIA, AMD, Apple Silicon, or CPU-only)
 * using command-line tools and system information.
 */

import { exec } from 'child_process';
import { promisify } from 'util';
import { platform } from 'os';
import { GPUDetector, GPUType } from './types.js';

const execAsync = promisify(exec);

/**
 * Default GPU detector implementation
 */
export class DefaultGPUDetector implements GPUDetector {
  private cachedGPUType: GPUType | null = null;

  /**
   * Detect GPU type on the system
   */
  async detectGPU(): Promise<GPUType> {
    // Return cached result if available
    if (this.cachedGPUType !== null) {
      return this.cachedGPUType;
    }

    const detectedType = await this.performDetection();
    this.cachedGPUType = detectedType;
    return detectedType;
  }

  /**
   * Check if GPU is available
   */
  async hasGPU(): Promise<boolean> {
    const gpuType = await this.detectGPU();
    return gpuType !== GPUType.CPU_ONLY;
  }

  /**
   * Perform actual GPU detection
   */
  private async performDetection(): Promise<GPUType> {
    const systemPlatform = platform();

    // Check for NVIDIA GPU
    if (await this.hasNVIDIA()) {
      return GPUType.NVIDIA;
    }

    // Check for AMD GPU (Linux only)
    if (systemPlatform === 'linux' && await this.hasAMD()) {
      return GPUType.AMD;
    }

    // Check for Apple Silicon (macOS only)
    if (systemPlatform === 'darwin' && await this.hasAppleSilicon()) {
      return GPUType.APPLE_SILICON;
    }

    // Default to CPU-only
    return GPUType.CPU_ONLY;
  }

  /**
   * Check for NVIDIA GPU using nvidia-smi
   */
  private async hasNVIDIA(): Promise<boolean> {
    try {
      const { stdout } = await execAsync('nvidia-smi --version', {
        timeout: 5000,
        windowsHide: true
      });
      return stdout.includes('NVIDIA');
    } catch {
      return false;
    }
  }

  /**
   * Check for AMD GPU using ROCm tools
   */
  private async hasAMD(): Promise<boolean> {
    try {
      // Try rocm-smi first
      await execAsync('rocm-smi --version', {
        timeout: 5000
      });
      return true;
    } catch {
      // Try alternative: check for AMD GPU in lspci
      try {
        const { stdout } = await execAsync('lspci | grep -i amd', {
          timeout: 5000
        });
        return stdout.toLowerCase().includes('vga') || stdout.toLowerCase().includes('display');
      } catch {
        return false;
      }
    }
  }

  /**
   * Check for Apple Silicon using system_profiler
   */
  private async hasAppleSilicon(): Promise<boolean> {
    try {
      const { stdout } = await execAsync('sysctl -n machdep.cpu.brand_string', {
        timeout: 5000
      });
      return stdout.includes('Apple');
    } catch {
      return false;
    }
  }

  /**
   * Clear cached GPU type (useful for testing)
   */
  clearCache(): void {
    this.cachedGPUType = null;
  }
}

/**
 * Create a new GPU detector instance
 */
export function createGPUDetector(): GPUDetector {
  return new DefaultGPUDetector();
}

