export class MemoryManager {
  private static instance: MemoryManager;
  private memoryThreshold = 0.85; // 85% memory usage threshold
  private checkInterval = 30000; // Check every 30 seconds
  private intervalId?: NodeJS.Timeout;

  private constructor() {
    this.startMonitoring();
  }

  public static getInstance(): MemoryManager {
    if (!MemoryManager.instance) {
      MemoryManager.instance = new MemoryManager();
    }
    return MemoryManager.instance;
  }

  private startMonitoring() {
    this.intervalId = setInterval(() => {
      this.checkMemoryUsage();
    }, this.checkInterval);
  }

  private checkMemoryUsage() {
    const usage = process.memoryUsage();
    const totalMemory = usage.heapTotal;
    const usedMemory = usage.heapUsed;
    const memoryUsagePercent = usedMemory / totalMemory;

    if (memoryUsagePercent > this.memoryThreshold) {
      console.warn(`High memory usage detected: ${(memoryUsagePercent * 100).toFixed(2)}%`);
      this.performGarbageCollection();
    }

    // Log memory stats every 5 minutes
    if (Date.now() % 300000 < this.checkInterval) {
      this.logMemoryStats();
    }
  }

  private performGarbageCollection() {
    if (global.gc) {
      console.log('Performing garbage collection...');
      global.gc();
      
      // Log memory after GC
      setTimeout(() => {
        this.logMemoryStats();
      }, 1000);
    } else {
      console.warn('Garbage collection not available. Start Node.js with --expose-gc flag.');
    }
  }

  private logMemoryStats() {
    const usage = process.memoryUsage();
    console.log('Memory Usage:', {
      rss: `${Math.round(usage.rss / 1024 / 1024)}MB`,
      heapTotal: `${Math.round(usage.heapTotal / 1024 / 1024)}MB`,
      heapUsed: `${Math.round(usage.heapUsed / 1024 / 1024)}MB`,
      external: `${Math.round(usage.external / 1024 / 1024)}MB`,
      arrayBuffers: `${Math.round(usage.arrayBuffers / 1024 / 1024)}MB`
    });
  }

  public getMemoryStats() {
    const usage = process.memoryUsage();
    return {
      rss: Math.round(usage.rss / 1024 / 1024),
      heapTotal: Math.round(usage.heapTotal / 1024 / 1024),
      heapUsed: Math.round(usage.heapUsed / 1024 / 1024),
      external: Math.round(usage.external / 1024 / 1024),
      arrayBuffers: Math.round(usage.arrayBuffers / 1024 / 1024),
      usagePercent: Math.round((usage.heapUsed / usage.heapTotal) * 100)
    };
  }

  public stop() {
    if (this.intervalId) {
      clearInterval(this.intervalId);
    }
  }
}