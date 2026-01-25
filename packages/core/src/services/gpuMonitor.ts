/**
 * GPU Monitor Service
 * 
 * Monitors GPU temperature and VRAM usage across different platforms.
 * Supports NVIDIA (nvidia-smi), AMD (rocm-smi), Apple Silicon (ioreg), and CPU fallback.
 */

import { exec } from 'child_process';
import { promisify } from 'util';

const execAsync = promisify(exec);

/**
 * GPU vendor types - includes Windows native for any vendor GPU
 */
export type GPUVendor = 'nvidia' | 'amd' | 'apple' | 'windows' | 'cpu';

/**
 * GPU information structure
 */
export interface GPUInfo {
  /** Whether a GPU is available */
  available: boolean;
  
  /** GPU vendor */
  vendor: GPUVendor;

  /** GPU Model Name (e.g. NVIDIA GeForce RTX 3090) */
  model?: string;
  
  /** Total VRAM in bytes */
  vramTotal: number;
  
  /** Used VRAM in bytes */
  vramUsed: number;
  
  /** Free VRAM in bytes */
  vramFree: number;
  
  /** Current temperature in Celsius */
  temperature: number;
  
  /** Maximum safe temperature in Celsius */
  temperatureMax: number;
  
  /** GPU utilization percentage (0-100) */
  gpuUtilization: number;
}

/**
 * GPU Monitor interface
 */
export interface GPUMonitor {
  /**
   * Get current GPU information
   */
  getInfo(): Promise<GPUInfo>;
  
  /**
   * Start polling GPU metrics at specified interval
   * @param intervalMs Polling interval in milliseconds
   */
  startPolling(intervalMs: number): void;
  
  /**
   * Stop polling GPU metrics
   */
  stopPolling(): void;
  
  /**
   * Register callback for GPU info updates
   * @param callback Function to call with updated GPU info
   */
  onUpdate(callback: (info: GPUInfo) => void): void;
  
  /**
   * Register callback for high temperature warnings
   * @param threshold Temperature threshold in Celsius
   * @param callback Function to call when temperature exceeds threshold
   */
  onHighTemp(threshold: number, callback: () => void): void;
  
  /**
   * Register callback for low VRAM warnings
   * @param threshold VRAM threshold in bytes
   * @param callback Function to call when free VRAM falls below threshold
   */
  onLowVRAM(threshold: number, callback: () => void): void;
}

/**
 * Default GPU Monitor implementation
 */
export class DefaultGPUMonitor implements GPUMonitor {
  private vendor: GPUVendor | null = null;
  private pollingInterval: NodeJS.Timeout | null = null;
  private updateCallbacks: Array<(info: GPUInfo) => void> = [];
  private highTempCallbacks: Map<number, Array<() => void>> = new Map();
  private lowVRAMCallbacks: Map<number, Array<() => void>> = new Map();
  private lastInfo: GPUInfo | null = null;
  private retryCount: number = 0;
  private maxRetries: number = 3;
  private baseRetryDelay: number = 1000; // 1 second
  private cachedModelName: string | undefined;

  /**
   * Log warning to debug output
   */
  private logWarning(message: string): void {
    if (process.env.OLLM_LOG_LEVEL === 'debug') {
      console.warn(`[GPU Monitor] ${message}`);
    }
  }

  /**
   * Log error to debug output
   */
  private logError(message: string, error?: unknown): void {
    if (process.env.OLLM_LOG_LEVEL === 'debug') {
      console.error(`[GPU Monitor] ${message}`, error);
    }
  }

  /**
   * Sleep for specified milliseconds
   */
  private sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  /**
   * Calculate exponential backoff delay
   */
  private getRetryDelay(attempt: number): number {
    return this.baseRetryDelay * Math.pow(2, attempt);
  }

  /**
   * Detect GPU vendor with error handling
   */
  async detectVendor(): Promise<GPUVendor> {
    if (this.vendor) {
      return this.vendor;
    }

    // Try NVIDIA first (works on Windows too if drivers installed)
    try {
      await execAsync('nvidia-smi --version', { timeout: 3000, windowsHide: true });
      this.vendor = 'nvidia';
      this.logWarning('Detected NVIDIA GPU');
      return 'nvidia';
    } catch {
      // Not NVIDIA, continue
    }

    // Try AMD (rocm-smi is Linux-only)
    if (process.platform !== 'win32') {
      try {
        await execAsync('rocm-smi --version', { timeout: 3000 });
        this.vendor = 'amd';
        this.logWarning('Detected AMD GPU');
        return 'amd';
      } catch {
        // Not AMD, continue
      }
    }

    // Try Apple Silicon
    if (process.platform === 'darwin') {
      try {
        const { stdout } = await execAsync('ioreg -r -c IOPlatformDevice', { timeout: 3000 });
        if (stdout.includes('apple-gpu') || stdout.includes('AGXAccelerator')) {
          this.vendor = 'apple';
          this.logWarning('Detected Apple Silicon GPU');
          return 'apple';
        }
      } catch {
        // Not Apple GPU, continue
      }
    }

    // Try Windows native GPU detection via PowerShell Get-Counter
    if (process.platform === 'win32') {
      try {
        // Check if GPU performance counters are available
        const { stdout } = await execAsync(
          'powershell -NoProfile -Command "Get-Counter -ListSet \'GPU*\' -ErrorAction SilentlyContinue | Select-Object -First 1 CounterSetName"',
          { timeout: 5000, windowsHide: true }
        );
        if (stdout.trim().length > 0) {
          this.vendor = 'windows';
          this.logWarning('Detected Windows GPU via Performance Counters');
          return 'windows';
        }
      } catch {
        // No Windows GPU counters available
      }
    }

    // Fallback to CPU
    this.vendor = 'cpu';
    this.logWarning('No GPU detected, falling back to CPU mode');
    return 'cpu';
  }

  /**
   * Query NVIDIA GPU using nvidia-smi with retry logic
   */
  async queryNVIDIA(): Promise<GPUInfo> {
    for (let attempt = 0; attempt <= this.maxRetries; attempt++) {
      try {
        // Include name in query if not cached
        const query = this.cachedModelName 
            ? 'memory.total,memory.used,memory.free,temperature.gpu,temperature.gpu.tlimit,utilization.gpu' 
            : 'memory.total,memory.used,memory.free,temperature.gpu,temperature.gpu.tlimit,utilization.gpu,name';

        const { stdout } = await execAsync(
          `nvidia-smi --query-gpu=${query} --format=csv,noheader,nounits`
        );

        const parts = stdout.trim().split(',').map(v => v.trim());
        
        const memTotal = parseFloat(parts[0]);
        const memUsed = parseFloat(parts[1]);
        const memFree = parseFloat(parts[2]);
        const temp = parseFloat(parts[3]);
        const tempMax = parseFloat(parts[4]);
        const util = parseFloat(parts[5]);
        
        // If name was requested, it's the last item
        if (!this.cachedModelName && parts.length > 6) {
             this.cachedModelName = parts.slice(6).join(' '); // Name might contain commas? nvidia-smi csv usually handles it or splits. Better safe logic later if needed.
             // Actually, nvidia-smi format=csv quotes strings if they contain delimiter. 
             // Simplest assumption: Name is the last part.
             this.cachedModelName = parts[parts.length-1]; 
        }

        // Reset retry count on success
        this.retryCount = 0;

        return {
          available: true,
          vendor: 'nvidia',
          model: this.cachedModelName,
          vramTotal: memTotal * 1024 * 1024, // Convert MiB to bytes
          vramUsed: memUsed * 1024 * 1024,
          vramFree: memFree * 1024 * 1024,
          temperature: temp,
          temperatureMax: tempMax || 90, // Default to 90°C if not available
          gpuUtilization: util
        };
      } catch (error) {
        if (attempt < this.maxRetries) {
          const delay = this.getRetryDelay(attempt);
          this.logWarning(`NVIDIA query failed (attempt ${attempt + 1}/${this.maxRetries + 1}), retrying in ${delay}ms...`);
          await this.sleep(delay);
        } else {
          this.logError(`Failed to query NVIDIA GPU after ${this.maxRetries + 1} attempts`, error);
          throw new Error(`Failed to query NVIDIA GPU: ${error}`);
        }
      }
    }

    // Should never reach here, but TypeScript needs it
    throw new Error('Failed to query NVIDIA GPU');
  }

  /**
   * Query AMD GPU using rocm-smi with retry logic
   */
  async queryAMD(): Promise<GPUInfo> {
    for (let attempt = 0; attempt <= this.maxRetries; attempt++) {
      try {
        // Query memory
        const { stdout: memOutput } = await execAsync('rocm-smi --showmeminfo vram');
        const memMatch = memOutput.match(/VRAM Total Memory \(B\):\s*(\d+)/);
        const memUsedMatch = memOutput.match(/VRAM Total Used Memory \(B\):\s*(\d+)/);
        
        const memTotal = memMatch ? parseInt(memMatch[1]) : 0;
        const memUsed = memUsedMatch ? parseInt(memUsedMatch[1]) : 0;

        // Query temperature
        const { stdout: tempOutput } = await execAsync('rocm-smi --showtemp');
        const tempMatch = tempOutput.match(/Temperature \(Sensor edge\) \(C\):\s*([\d.]+)/);
        const temp = tempMatch ? parseFloat(tempMatch[1]) : 0;

        // Query utilization
        const { stdout: utilOutput } = await execAsync('rocm-smi --showuse');
        const utilMatch = utilOutput.match(/GPU use \(%\):\s*([\d.]+)/);
        const util = utilMatch ? parseFloat(utilMatch[1]) : 0;

        if (!this.cachedModelName) {
            // Try to get product name
            try {
                const { stdout: nameOutput } = await execAsync('rocm-smi --showproductname');
                const nameMatch = nameOutput.match(/Card Series:\s*(.+)/);
                if (nameMatch) this.cachedModelName = nameMatch[1].trim();
            } catch (_e) { /* ignore */ }
        }

        // Reset retry count on success
        this.retryCount = 0;

        return {
          available: true,
          vendor: 'amd',
          model: this.cachedModelName || 'AMD Radeon',
          vramTotal: memTotal,
          vramUsed: memUsed,
          vramFree: memTotal - memUsed,
          temperature: temp,
          temperatureMax: 90, // AMD GPUs typically max at 90°C
          gpuUtilization: util
        };
      } catch (error) {
        if (attempt < this.maxRetries) {
          const delay = this.getRetryDelay(attempt);
          this.logWarning(`AMD query failed (attempt ${attempt + 1}/${this.maxRetries + 1}), retrying in ${delay}ms...`);
          await this.sleep(delay);
        } else {
          this.logError(`Failed to query AMD GPU after ${this.maxRetries + 1} attempts`, error);
          throw new Error(`Failed to query AMD GPU: ${error}`);
        }
      }
    }

    throw new Error('Failed to query AMD GPU');
  }

  /**
   * Query Apple Silicon GPU using ioreg with retry logic
   */
  async queryApple(): Promise<GPUInfo> {
    for (let attempt = 0; attempt <= this.maxRetries; attempt++) {
      try {
        if (!this.cachedModelName) {
             const { stdout } = await execAsync('system_profiler SPDisplaysDataType');
             const match = stdout.match(/Chipset Model:\s*(.+)/);
             if (match) this.cachedModelName = match[1].trim();
        }

        // Apple Silicon doesn't expose detailed GPU metrics easily
        // We'll use system_profiler for basic info
        const { stdout } = await execAsync('system_profiler SPDisplaysDataType');
        
        // Extract VRAM info if available
        const vramMatch = stdout.match(/VRAM \(Total\):\s*(\d+)\s*MB/);
        const vramTotal = vramMatch ? parseInt(vramMatch[1]) * 1024 * 1024 : 0;

        // Apple Silicon shares memory with system, so we can't get accurate used/free
        // We'll estimate based on system memory
        const { stdout: memOutput } = await execAsync('vm_stat');
        const pageSize = 4096; // macOS page size
        const freeMatch = memOutput.match(/Pages free:\s*(\d+)/);
        const activeMatch = memOutput.match(/Pages active:\s*(\d+)/);
        
        const freePages = freeMatch ? parseInt(freeMatch[1]) : 0;
        const activePages = activeMatch ? parseInt(activeMatch[1]) : 0;
        
        const memFree = freePages * pageSize;
        const memUsed = activePages * pageSize;

        // Reset retry count on success
        this.retryCount = 0;

        // Apple Silicon doesn't expose temperature easily, use a safe default
        return {
          available: true,
          vendor: 'apple',
          model: this.cachedModelName || 'Apple Silicon GPU',
          vramTotal: vramTotal || memUsed + memFree,
          vramUsed: memUsed,
          vramFree: memFree,
          temperature: 0, // Not available
          temperatureMax: 100, // Conservative estimate
          gpuUtilization: 0 // Not easily available
        };
      } catch (error) {
        if (attempt < this.maxRetries) {
          const delay = this.getRetryDelay(attempt);
          this.logWarning(`Apple GPU query failed (attempt ${attempt + 1}/${this.maxRetries + 1}), retrying in ${delay}ms...`);
          await this.sleep(delay);
        } else {
          this.logError(`Failed to query Apple GPU after ${this.maxRetries + 1} attempts`, error);
          throw new Error(`Failed to query Apple GPU: ${error}`);
        }
      }
    }

    throw new Error('Failed to query Apple GPU');
  }

  /**
   * Query system RAM as CPU fallback
   */
  async queryCPU(): Promise<GPUInfo> {
    try {
      if (process.platform === 'win32') {
        // Windows
        const { stdout } = await execAsync('wmic OS get FreePhysicalMemory,TotalVisibleMemorySize /Value');
        const totalMatch = stdout.match(/TotalVisibleMemorySize=(\d+)/);
        const freeMatch = stdout.match(/FreePhysicalMemory=(\d+)/);
        
        const total = totalMatch ? parseInt(totalMatch[1]) * 1024 : 0; // Convert KB to bytes
        const free = freeMatch ? parseInt(freeMatch[1]) * 1024 : 0;
        
        return {
          available: false,
          vendor: 'cpu',
          model: 'System RAM (CPU Mode)',
          vramTotal: total,
          vramUsed: total - free,
          vramFree: free,
          temperature: 0,
          temperatureMax: 100,
          gpuUtilization: 0
        };
      } else {
        // Unix-like systems
        const { stdout } = await execAsync('free -b');
        const lines = stdout.split('\n');
        const memLine = lines.find(line => line.startsWith('Mem:'));
        
        if (memLine) {
          const values = memLine.split(/\s+/).filter(v => v);
          const total = parseInt(values[1]);
          const used = parseInt(values[2]);
          const free = parseInt(values[3]);
          
          return {
            available: false,
            vendor: 'cpu',
            model: 'System RAM (CPU Mode)',
            vramTotal: total,
            vramUsed: used,
            vramFree: free,
            temperature: 0,
            temperatureMax: 100,
            gpuUtilization: 0
          };
        }
      }

      // Fallback if commands fail
      return {
        available: false,
        vendor: 'cpu',
        model: 'CPU Fallback',
        vramTotal: 0,
        vramUsed: 0,
        vramFree: 0,
        temperature: 0,
        temperatureMax: 100,
        gpuUtilization: 0
      };
    } catch (_error) {
      // Return empty info on error
      return {
        available: false,
        vendor: 'cpu',
        vramTotal: 0,
        vramUsed: 0,
        vramFree: 0,
        temperature: 0,
        temperatureMax: 100,
        gpuUtilization: 0
      };
    }
  }

  /**
   * Query Windows GPU using PowerShell Get-Counter for any GPU vendor
   * Uses Windows Performance Counters which work with NVIDIA, AMD, and Intel GPUs
   */
  async queryWindowsGPU(): Promise<GPUInfo> {
    for (let attempt = 0; attempt <= this.maxRetries; attempt++) {
      try {
        // Attempt to fetch model name if not cached
        if (!this.cachedModelName) {
            try {
                const { stdout } = await execAsync(
                    `powershell -NoProfile -Command "Get-CimInstance Win32_VideoController | Select-Object -ExpandProperty Name -First 1"`,
                    { timeout: 5000, windowsHide: true } 
                );
                this.cachedModelName = stdout.trim();
            } catch (_e) {
                this.cachedModelName = 'Windows Generic GPU';
            }
        }

        // Query GPU adapter memory counters
        // These counters work with any GPU vendor on Windows
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
        const [localUsage, dedicatedUsage, _sharedUsage] = memValues;
        
        // Calculate VRAM metrics
        const vramUsed = localUsage + dedicatedUsage;
        
        // Query total dedicated memory from registry (more accurate than performance counters)
        let vramTotal = 0;
        try {
          const { stdout: regOutput } = await execAsync(
            `powershell -NoProfile -Command "` +
            `Get-ItemProperty -Path 'HKLM:\\SYSTEM\\ControlSet001\\Control\\Class\\{4d36e968-e325-11ce-bfc1-08002be10318}\\0*' -ErrorAction SilentlyContinue | ` +
            `ForEach-Object { if ($_.'HardwareInformation.qwMemorySize') { $_.'HardwareInformation.qwMemorySize' } } | ` +
            `Measure-Object -Maximum | Select-Object -ExpandProperty Maximum"`,
            { timeout: 5000, windowsHide: true }
          );
          vramTotal = parseInt(regOutput.trim(), 10) || 0;
        } catch {
          // If registry query fails, estimate from used memory
          vramTotal = Math.max(vramUsed * 2, 4 * 1024 * 1024 * 1024); // Estimate or default to 4GB
        }

        const vramFree = Math.max(0, vramTotal - vramUsed);

        // Reset retry count on success
        this.retryCount = 0;

        return {
          available: true,
          vendor: 'windows',
          model: this.cachedModelName,
          vramTotal,
          vramUsed,
          vramFree,
          temperature: 0, // Not available via performance counters
          temperatureMax: 100, // Conservative default
          gpuUtilization: 0 // Could query GPU Engine counters if needed
        };
      } catch (error) {
        if (attempt < this.maxRetries) {
          const delay = this.getRetryDelay(attempt);
          this.logWarning(`Windows GPU query failed (attempt ${attempt + 1}/${this.maxRetries + 1}), retrying in ${delay}ms...`);
          await this.sleep(delay);
        } else {
          this.logError(`Failed to query Windows GPU after ${this.maxRetries + 1} attempts`, error);
          throw new Error(`Failed to query Windows GPU: ${error}`);
        }
      }
    }

    throw new Error('Failed to query Windows GPU');
  }

  /**
   * Get current GPU information with automatic fallback to CPU mode
   */
  async getInfo(): Promise<GPUInfo> {
    const vendor = await this.detectVendor();

    let info: GPUInfo;
    try {
      switch (vendor) {
        case 'nvidia':
          info = await this.queryNVIDIA();
          break;
        case 'amd':
          info = await this.queryAMD();
          break;
        case 'apple':
          info = await this.queryApple();
          break;
        case 'windows':
          info = await this.queryWindowsGPU();
          break;
        case 'cpu':
        default:
          info = await this.queryCPU();
          break;
      }

      this.lastInfo = info;

      // Check thresholds and trigger callbacks
      this.checkThresholds(info);

      return info;
    } catch (error) {
      // On error, fall back to CPU mode silently
      this.logError(`GPU query failed, falling back to CPU mode`, error);
      
      // Try to get system RAM info
      try {
        info = await this.queryCPU();
      } catch (cpuError) {
        // If even CPU query fails, return empty info
        this.logError(`CPU fallback query also failed`, cpuError);
        info = {
          available: false,
          vendor: 'cpu',
          vramTotal: 0,
          vramUsed: 0,
          vramFree: 0,
          temperature: 0,
          temperatureMax: 100,
          gpuUtilization: 0
        };
      }
      
      this.lastInfo = info;
      return info;
    }
  }

  /**
   * Check thresholds and trigger callbacks
   */
  private checkThresholds(info: GPUInfo): void {
    // Check high temperature thresholds
    for (const [threshold, callbacks] of this.highTempCallbacks.entries()) {
      if (info.temperature > threshold) {
        callbacks.forEach(cb => cb());
      }
    }

    // Check low VRAM thresholds
    for (const [threshold, callbacks] of this.lowVRAMCallbacks.entries()) {
      if (info.vramFree < threshold) {
        callbacks.forEach(cb => cb());
      }
    }
  }

  /**
   * Start polling GPU metrics with error handling
   */
  startPolling(intervalMs: number): void {
    if (this.pollingInterval) {
      this.stopPolling();
    }

    this.pollingInterval = setInterval(async () => {
      try {
        const info = await this.getInfo();
        this.updateCallbacks.forEach(cb => {
          try {
            cb(info);
          } catch (error) {
            this.logError('Error in update callback', error);
          }
        });
      } catch (error) {
        this.logError('Error polling GPU', error);
        // Continue polling despite errors
      }
    }, intervalMs);
  }

  /**
   * Stop polling GPU metrics
   */
  stopPolling(): void {
    if (this.pollingInterval) {
      clearInterval(this.pollingInterval);
      this.pollingInterval = null;
    }
  }

  /**
   * Register callback for GPU info updates
   */
  onUpdate(callback: (info: GPUInfo) => void): void {
    this.updateCallbacks.push(callback);
  }

  /**
   * Register callback for high temperature warnings
   */
  onHighTemp(threshold: number, callback: () => void): void {
    if (!this.highTempCallbacks.has(threshold)) {
      this.highTempCallbacks.set(threshold, []);
    }
    this.highTempCallbacks.get(threshold)!.push(callback);
  }

  /**
   * Register callback for low VRAM warnings
   */
  onLowVRAM(threshold: number, callback: () => void): void {
    if (!this.lowVRAMCallbacks.has(threshold)) {
      this.lowVRAMCallbacks.set(threshold, []);
    }
    this.lowVRAMCallbacks.get(threshold)!.push(callback);
  }
}

/**
 * Create a new GPU monitor instance
 */
export function createGPUMonitor(): GPUMonitor {
  return new DefaultGPUMonitor();
}
