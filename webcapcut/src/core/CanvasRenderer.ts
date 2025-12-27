import { WebGPUContext } from './WebGPUContext';
import { calculateVideoTransform } from '../utils/videoTransform';

export class CanvasRenderer {
    private pipeline: GPURenderPipeline | null = null;
    private sampler: GPUSampler | null = null;
    private transformBuffer: GPUBuffer | null = null;
    private animationId: number | null = null;
    private frameCount = 0;
    private lastFpsUpdate = performance.now();
    private fps = 0;
    private lastFrameTime = performance.now();
    private device: GPUDevice | null = null;

    // Cache for transform to avoid recalculating every frame
    private lastVideoWidth = 0;
    private lastVideoHeight = 0;
    private lastCanvasWidth = 0;
    private lastCanvasHeight = 0;

    async init(gpu: WebGPUContext, shaderCode: string): Promise<void> {
        this.device = gpu.device;

        const shaderModule = gpu.device.createShaderModule({
            code: shaderCode,
            label: 'Video Shader',
        });

        this.pipeline = gpu.device.createRenderPipeline({
            layout: 'auto',
            vertex: {
                module: shaderModule,
                entryPoint: 'vs_main',
            },
            fragment: {
                module: shaderModule,
                entryPoint: 'fs_main',
                targets: [
                    {
                        format: navigator.gpu.getPreferredCanvasFormat(),
                    },
                ],
            },
            primitive: {
                topology: 'triangle-strip',
            },
            label: 'Video Render Pipeline',
        });

        this.sampler = gpu.device.createSampler({
            magFilter: 'linear',
            minFilter: 'linear',
            label: 'Video Sampler',
        });

        // Create transform uniform buffer (4 floats: scaleX, scaleY, offsetX, offsetY)
        this.transformBuffer = gpu.device.createBuffer({
            size: 16, // 4 x float32
            usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST,
            label: 'Transform Uniform Buffer',
        });

        // Initialize with identity transform
        this.updateTransform(1, 1, 0, 0);

        console.log('CanvasRenderer initialized');
    }

    /**
     * Update transform uniform buffer
     */
    private updateTransform(scaleX: number, scaleY: number, offsetX: number, offsetY: number): void {
        if (!this.device || !this.transformBuffer) return;

        const transformData = new Float32Array([scaleX, scaleY, offsetX, offsetY]);
        this.device.queue.writeBuffer(this.transformBuffer, 0, transformData);
    }

    /**
     * Reset transform cache - call when canvas size changes
     * This forces transform recalculation on next frame
     */
    resetTransformCache(): void {
        this.lastCanvasWidth = 0;
        this.lastCanvasHeight = 0;
        console.log('[Renderer] Transform cache reset - will recalculate on next frame');
    }

    private clearCanvas(gpu: WebGPUContext): void {
        const commandEncoder = gpu.device.createCommandEncoder({
            label: 'Clear Command Encoder',
        });

        const textureView = gpu.context.getCurrentTexture().createView();

        const renderPass = commandEncoder.beginRenderPass({
            colorAttachments: [
                {
                    view: textureView,
                    clearValue: { r: 0, g: 0, b: 0, a: 1 },
                    loadOp: 'clear',
                    storeOp: 'store',
                },
            ],
            label: 'Clear Render Pass',
        });

        renderPass.end();
        gpu.device.queue.submit([commandEncoder.finish()]);
    }

    /**
     * TIMELINE-DRIVEN render loop
     */
    startRenderLoop(
        gpu: WebGPUContext,
        getSource: (time: number) => HTMLVideoElement | VideoFrame | null
    ): void {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        let playbackStore: any;
        import('../store/playbackStore').then(module => {
            playbackStore = module.usePlaybackStore;
        });

        this.lastFrameTime = performance.now();

        const render = () => {
            this.animationId = requestAnimationFrame(render);

            if (!playbackStore) {
                return;
            }

            const state = playbackStore.getState();
            const { isPlaying, duration, currentTime, playbackRate, updateCurrentTime } = state;

            // Timeline-driven time update (always use performance timer for global timeline)
            // Note: AudioSystem now handles per-clip audio, not global timeline
            if (isPlaying) {
                const now = performance.now();
                const deltaMs = now - this.lastFrameTime;
                this.lastFrameTime = now;

                const deltaTime = deltaMs * 1000 * playbackRate; // microseconds
                const newTime = currentTime + deltaTime;

                if (newTime >= duration) {
                    updateCurrentTime(duration);
                    playbackStore.getState().pause();
                } else {
                    updateCurrentTime(newTime);
                }
            } else {
                this.lastFrameTime = performance.now();
            }

            // Get source for current time
            const source = getSource(state.currentTime);

            // Sync video element
            if (source && source instanceof HTMLVideoElement) {
                if (isPlaying && source.paused) {
                    source.playbackRate = playbackRate;
                    source.play().catch(() => { });
                } else if (!isPlaying && !source.paused) {
                    source.pause();
                }

                if (source.playbackRate !== playbackRate) {
                    source.playbackRate = playbackRate;
                }
            }

            // Render
            if (source) {
                try {
                    this.renderSource(gpu, source);
                } catch (e) {
                    if (this.frameCount < 10) {
                        console.error('[Renderer] Render error:', e);
                    }
                }
            } else {
                this.clearCanvas(gpu);
            }

            // FPS counter (log every 5 seconds to reduce overhead)
            this.frameCount++;
            const now = performance.now();
            if (now - this.lastFpsUpdate >= 5000) {
                this.fps = Math.round(this.frameCount / 5);
                this.frameCount = 0;
                this.lastFpsUpdate = now;
                console.log('[Renderer] FPS:', this.fps);
            }
        };

        this.animationId = requestAnimationFrame(render);
    }

    stop(): void {
        if (this.animationId !== null) {
            cancelAnimationFrame(this.animationId);
            this.animationId = null;
        }
    }

    private renderSource(gpu: WebGPUContext, source: HTMLVideoElement | VideoFrame): void {
        if (!this.pipeline || !this.sampler || !this.transformBuffer) {
            console.error('Renderer not initialized');
            return;
        }

        // Get video dimensions
        let videoWidth: number, videoHeight: number;
        if (source instanceof HTMLVideoElement) {
            if (source.readyState < 3 || source.videoWidth === 0 || source.videoHeight === 0) {
                return;
            }
            videoWidth = source.videoWidth;
            videoHeight = source.videoHeight;
        } else {
            videoWidth = source.displayWidth;
            videoHeight = source.displayHeight;
        }

        // Get canvas dimensions
        const canvasWidth = gpu.canvas.width;
        const canvasHeight = gpu.canvas.height;

        // Update transform if dimensions changed
        if (videoWidth !== this.lastVideoWidth ||
            videoHeight !== this.lastVideoHeight ||
            canvasWidth !== this.lastCanvasWidth ||
            canvasHeight !== this.lastCanvasHeight) {

            // Use utility function for correct letterbox/pillarbox calculation
            const transformData = calculateVideoTransform(
                canvasWidth, canvasHeight, videoWidth, videoHeight
            );

            if (this.device && this.transformBuffer) {
                this.device.queue.writeBuffer(this.transformBuffer, 0, transformData.buffer);
            }

            this.lastVideoWidth = videoWidth;
            this.lastVideoHeight = videoHeight;
            this.lastCanvasWidth = canvasWidth;
            this.lastCanvasHeight = canvasHeight;
        }

        // Import video as external texture
        const videoTexture = gpu.device.importExternalTexture({
            source: source,
            label: 'Video Source Texture',
        });

        const bindGroup = gpu.device.createBindGroup({
            layout: this.pipeline.getBindGroupLayout(0),
            entries: [
                { binding: 0, resource: this.sampler },
                { binding: 1, resource: videoTexture },
                { binding: 2, resource: { buffer: this.transformBuffer } },
            ],
            label: 'Video Bind Group',
        });

        const commandEncoder = gpu.device.createCommandEncoder({
            label: 'Render Command Encoder',
        });

        const textureView = gpu.context.getCurrentTexture().createView();

        const renderPass = commandEncoder.beginRenderPass({
            colorAttachments: [
                {
                    view: textureView,
                    clearValue: { r: 0, g: 0, b: 0, a: 1 },
                    loadOp: 'clear',
                    storeOp: 'store',
                },
            ],
            label: 'Video Render Pass',
        });

        renderPass.setPipeline(this.pipeline);
        renderPass.setBindGroup(0, bindGroup);
        renderPass.draw(4, 1, 0, 0);
        renderPass.end();

        gpu.device.queue.submit([commandEncoder.finish()]);
    }

    getFps(): number {
        return this.fps;
    }
}
