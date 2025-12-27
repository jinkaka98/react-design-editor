/**
 * PerformanceMonitor - Centralized performance tracking and debugging
 * Enable detailed logging for all components to identify bottlenecks
 */

export type ComponentType =
    | 'VideoPlayer'
    | 'CanvasRenderer'
    | 'AudioSystem'
    | 'Export'
    | 'Timeline'
    | 'MultiVideo'
    | 'WebGPU';

interface PerformanceMetrics {
    component: ComponentType;
    operation: string;
    duration: number;
    timestamp: number;
    metadata?: Record<string, unknown>;
}

interface ComponentStats {
    totalCalls: number;
    totalTime: number;
    avgTime: number;
    maxTime: number;
    minTime: number;
    lastCalls: number[];
}

class PerformanceMonitorClass {
    private enabled = true;
    private verboseMode = true; // Set to false in production
    private metrics: PerformanceMetrics[] = [];
    private componentStats: Map<string, ComponentStats> = new Map();
    private frameTimings: number[] = [];
    private lastFrameTime = performance.now();

    // Enable/disable all logging
    setEnabled(enabled: boolean): void {
        this.enabled = enabled;
        console.log(`[PerformanceMonitor] ${enabled ? '✓ Enabled' : '✗ Disabled'}`);
    }

    setVerbose(verbose: boolean): void {
        this.verboseMode = verbose;
    }

    // Track operation timing
    startOperation(component: ComponentType, operation: string): () => void {
        if (!this.enabled) return () => { };

        const startTime = performance.now();

        return () => {
            const duration = performance.now() - startTime;
            this.recordMetric(component, operation, duration);
        };
    }

    // Record a metric with duration
    recordMetric(
        component: ComponentType,
        operation: string,
        duration: number,
        metadata?: Record<string, unknown>
    ): void {
        if (!this.enabled) return;

        const key = `${component}:${operation}`;
        const stats = this.componentStats.get(key) || {
            totalCalls: 0,
            totalTime: 0,
            avgTime: 0,
            maxTime: 0,
            minTime: Infinity,
            lastCalls: []
        };

        stats.totalCalls++;
        stats.totalTime += duration;
        stats.avgTime = stats.totalTime / stats.totalCalls;
        stats.maxTime = Math.max(stats.maxTime, duration);
        stats.minTime = Math.min(stats.minTime, duration);
        stats.lastCalls.push(duration);
        if (stats.lastCalls.length > 10) stats.lastCalls.shift();

        this.componentStats.set(key, stats);

        // Verbose logging for slow operations
        if (this.verboseMode && duration > 16) { // >16ms = below 60fps
            console.warn(`[${component}] ⚠️ Slow ${operation}: ${duration.toFixed(2)}ms`, metadata || '');
        }

        // Store metric
        this.metrics.push({
            component,
            operation,
            duration,
            timestamp: performance.now(),
            metadata
        });

        // Keep only last 1000 metrics
        if (this.metrics.length > 1000) {
            this.metrics = this.metrics.slice(-500);
        }
    }

    // Track frame timing for FPS analysis
    recordFrame(): void {
        const now = performance.now();
        const frameTime = now - this.lastFrameTime;
        this.lastFrameTime = now;

        this.frameTimings.push(frameTime);
        if (this.frameTimings.length > 120) {
            this.frameTimings.shift();
        }
    }

    // Get FPS statistics
    getFpsStats(): { current: number; avg: number; min: number; max: number; dropped: number } {
        if (this.frameTimings.length === 0) {
            return { current: 0, avg: 0, min: 0, max: 0, dropped: 0 };
        }

        const avgFrameTime = this.frameTimings.reduce((a, b) => a + b, 0) / this.frameTimings.length;
        const minFrameTime = Math.min(...this.frameTimings);
        const maxFrameTime = Math.max(...this.frameTimings);
        const droppedFrames = this.frameTimings.filter(t => t > 33.33).length; // >30fps threshold

        return {
            current: 1000 / (this.frameTimings[this.frameTimings.length - 1] || 16.67),
            avg: 1000 / avgFrameTime,
            min: 1000 / maxFrameTime,
            max: 1000 / minFrameTime,
            dropped: droppedFrames
        };
    }

    // Log component info with consistent format
    log(component: ComponentType, message: string, data?: unknown): void {
        if (!this.enabled || !this.verboseMode) return;
        console.log(`[${component}] ${message}`, data !== undefined ? data : '');
    }

    // Log warning
    warn(component: ComponentType, message: string, data?: unknown): void {
        if (!this.enabled) return;
        console.warn(`[${component}] ⚠️ ${message}`, data !== undefined ? data : '');
    }

    // Log error
    error(component: ComponentType, message: string, error?: unknown): void {
        console.error(`[${component}] ❌ ${message}`, error || '');
    }

    // Print performance summary
    printSummary(): void {
        console.log('╔════════════════════════════════════════════════════════════╗');
        console.log('║              PERFORMANCE SUMMARY                            ║');
        console.log('╠════════════════════════════════════════════════════════════╣');

        const fps = this.getFpsStats();
        console.log(`║ FPS: ${fps.avg.toFixed(1)} avg, ${fps.min.toFixed(1)}-${fps.max.toFixed(1)} range`);
        console.log(`║ Dropped frames (>30fps): ${fps.dropped}/${this.frameTimings.length}`);
        console.log('╠════════════════════════════════════════════════════════════╣');

        // Sort by avg time descending
        const sorted = [...this.componentStats.entries()].sort((a, b) => b[1].avgTime - a[1].avgTime);

        console.log('║ Operation                              │ Avg     │ Max     │ Calls');
        console.log('╟────────────────────────────────────────┼─────────┼─────────┼───────');

        for (const [key, stats] of sorted.slice(0, 15)) {
            const name = key.substring(0, 38).padEnd(38);
            const avg = `${stats.avgTime.toFixed(1)}ms`.padStart(7);
            const max = `${stats.maxTime.toFixed(1)}ms`.padStart(7);
            const calls = stats.totalCalls.toString().padStart(6);
            console.log(`║ ${name} │ ${avg} │ ${max} │ ${calls}`);
        }

        console.log('╚════════════════════════════════════════════════════════════╝');
    }

    // Clear all stats
    reset(): void {
        this.metrics = [];
        this.componentStats.clear();
        this.frameTimings = [];
        console.log('[PerformanceMonitor] Stats reset');
    }
}

export const perfMonitor = new PerformanceMonitorClass();

// Attach to window for debugging
if (typeof window !== 'undefined') {
    (window as unknown as { perfMonitor: PerformanceMonitorClass }).perfMonitor = perfMonitor;
}
