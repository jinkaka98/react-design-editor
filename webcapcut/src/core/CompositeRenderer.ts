/**
 * CompositeRenderer - Multi-layer video compositing using 2D Canvas
 * Renders multiple video layers (tracks) with proper ordering and transforms
 * 
 * This provides a simpler alternative to WebGPU for multi-track compositing.
 */
import { ClipTransform, DEFAULT_CLIP_TRANSFORM } from '../types/timeline';
import { perfMonitor } from '../utils/PerformanceMonitor';

export interface VideoLayer {
    video: HTMLVideoElement;
    trackIndex: number;  // Lower = bottom layer, higher = top
    transform?: ClipTransform;
    assetId: string;
    clipId: string;
}

export class CompositeRenderer {
    private canvas: HTMLCanvasElement | null = null;
    private ctx: CanvasRenderingContext2D | null = null;
    private animationId: number | null = null;
    private lastFpsUpdate = performance.now();
    private frameCount = 0;
    private fps = 0;

    // Debug flags
    private debugMode = true;
    private lastLayerCount = 0;

    /**
     * Initialize with target canvas
     */
    init(canvas: HTMLCanvasElement): void {
        this.canvas = canvas;
        this.ctx = canvas.getContext('2d', { alpha: false });

        if (!this.ctx) {
            console.error('[CompositeRenderer] ❌ Failed to get 2D context');
            return;
        }

        console.log('[CompositeRenderer] ✅ Initialized', {
            width: canvas.width,
            height: canvas.height
        });
    }

    /**
     * Start render loop with multi-layer support
     */
    startRenderLoop(getLayers: () => VideoLayer[]): void {
        if (!this.canvas || !this.ctx) {
            console.error('[CompositeRenderer] ❌ Not initialized');
            return;
        }

        const ctx = this.ctx;
        const canvas = this.canvas;

        const render = () => {
            this.animationId = requestAnimationFrame(render);
            const frameStart = performance.now();

            // Get active layers
            const layers = getLayers();

            // Debug: Log layer count changes
            if (this.debugMode && layers.length !== this.lastLayerCount) {
                console.log(`[CompositeRenderer] 🎬 Layer count changed: ${this.lastLayerCount} → ${layers.length}`);
                layers.forEach((l, i) => {
                    console.log(`  Layer ${i}: track=${l.trackIndex}, asset=${l.assetId}, ready=${l.video.readyState >= 2}`);
                });
                this.lastLayerCount = layers.length;
            }

            // Clear canvas
            ctx.fillStyle = 'black';
            ctx.fillRect(0, 0, canvas.width, canvas.height);

            if (layers.length === 0) {
                // No layers to render
                this.updateFps(frameStart);
                return;
            }

            // Sort layers by track index (lower = render first = bottom)
            const sortedLayers = [...layers].sort((a, b) => a.trackIndex - b.trackIndex);

            // Render each layer bottom to top
            for (let i = 0; i < sortedLayers.length; i++) {
                const layer = sortedLayers[i];
                this.renderLayer(ctx, canvas, layer, i === 0);
            }

            this.updateFps(frameStart);
        };

        console.log('[CompositeRenderer] 🚀 Starting render loop');
        this.animationId = requestAnimationFrame(render);
    }

    /**
     * Render a single video layer with transform
     */
    private renderLayer(
        ctx: CanvasRenderingContext2D,
        canvas: HTMLCanvasElement,
        layer: VideoLayer,
        _isBottomLayer: boolean  // Reserved for future alpha compositing
    ): void {
        const { video, transform = DEFAULT_CLIP_TRANSFORM } = layer;

        // Validate video - use lower threshold (HAVE_METADATA = 1) for paused videos
        if (!video) {
            if (this.debugMode) {
                console.warn(`[CompositeRenderer] ⚠️ No video element for asset=${layer.assetId}`);
            }
            return;
        }

        // Trigger load if not ready
        if (video.readyState < 1) {
            video.load(); // Force buffering
            if (this.debugMode) {
                console.warn(`[CompositeRenderer] ⚠️ Triggering load for: asset=${layer.assetId}, state=${video.readyState}`);
            }
            return;
        }

        if (video.videoWidth === 0 || video.videoHeight === 0) {
            if (this.debugMode && this.frameCount < 10) {
                console.warn(`[CompositeRenderer] ⚠️ Invalid video dimensions: ${video.videoWidth}x${video.videoHeight}`);
            }
            return;
        }

        const videoWidth = video.videoWidth;
        const videoHeight = video.videoHeight;
        const canvasWidth = canvas.width;
        const canvasHeight = canvas.height;

        // Calculate base fit (letterbox/pillarbox)
        const videoAspect = videoWidth / videoHeight;
        const canvasAspect = canvasWidth / canvasHeight;

        let baseWidth: number, baseHeight: number;
        if (videoAspect > canvasAspect) {
            // Video wider than canvas - fit to width
            baseWidth = canvasWidth;
            baseHeight = canvasWidth / videoAspect;
        } else {
            // Video taller than canvas - fit to height
            baseHeight = canvasHeight;
            baseWidth = canvasHeight * videoAspect;
        }

        // Apply transform: scale
        const scaledWidth = baseWidth * transform.scaleX;
        const scaledHeight = baseHeight * transform.scaleY;

        // Apply transform: position (normalized -1 to 1)
        const centerX = canvasWidth / 2;
        const centerY = canvasHeight / 2;
        const offsetX = transform.x * (canvasWidth / 2);
        const offsetY = transform.y * (canvasHeight / 2);

        const drawX = centerX + offsetX - scaledWidth / 2;
        const drawY = centerY + offsetY - scaledHeight / 2;

        // Save context state
        ctx.save();

        // Apply rotation around center of video
        if (transform.rotation !== 0) {
            const rotationCenterX = centerX + offsetX;
            const rotationCenterY = centerY + offsetY;
            ctx.translate(rotationCenterX, rotationCenterY);
            ctx.rotate((transform.rotation * Math.PI) / 180);
            ctx.translate(-rotationCenterX, -rotationCenterY);
        }

        // Draw video
        try {
            ctx.drawImage(video, drawX, drawY, scaledWidth, scaledHeight);
        } catch (e) {
            console.error('[CompositeRenderer] ❌ drawImage failed:', e);
        }

        // Restore context
        ctx.restore();
    }

    /**
     * Update FPS counter
     */
    private updateFps(frameStart: number): void {
        this.frameCount++;
        const now = performance.now();

        // Update FPS every 5 seconds
        if (now - this.lastFpsUpdate >= 5000) {
            this.fps = Math.round(this.frameCount / 5);
            this.frameCount = 0;
            this.lastFpsUpdate = now;

            const stats = perfMonitor.getFpsStats();
            console.log(`[CompositeRenderer] FPS: ${this.fps} | Layers: ${this.lastLayerCount} | Avg: ${stats.avg.toFixed(1)}`);
        }

        perfMonitor.recordFrame();

        const frameTime = now - frameStart;
        if (frameTime > 16.67) {
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            (perfMonitor as any).recordMetric?.('CompositeRenderer', 'slowFrame', frameTime);
        }
    }

    /**
     * Stop render loop
     */
    stop(): void {
        if (this.animationId) {
            cancelAnimationFrame(this.animationId);
            this.animationId = null;
            console.log('[CompositeRenderer] ⏹️ Stopped');
        }
    }

    /**
     * Get current FPS
     */
    getFps(): number {
        return this.fps;
    }

    /**
     * Enable/disable debug logging
     */
    setDebugMode(enabled: boolean): void {
        this.debugMode = enabled;
    }
}

// Singleton for easy access
let compositeRendererInstance: CompositeRenderer | null = null;

export function getCompositeRenderer(): CompositeRenderer {
    if (!compositeRendererInstance) {
        compositeRendererInstance = new CompositeRenderer();
    }
    return compositeRendererInstance;
}
