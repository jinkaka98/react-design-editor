/**
 * Custom error classes for better error handling
 */
export class WebGPUNotSupportedError extends Error {
    constructor(message: string) {
        super(message);
        this.name = 'WebGPUNotSupportedError';
    }
}

export class GPUAdapterError extends Error {
    constructor(message: string) {
        super(message);
        this.name = 'GPUAdapterError';
    }
}

export class GPUDeviceError extends Error {
    constructor(message: string) {
        super(message);
        this.name = 'GPUDeviceError';
    }
}

export class WebGPUContext {
    private static instance: WebGPUContext | null = null;
    public device!: GPUDevice;
    public context!: GPUCanvasContext;
    public canvas!: HTMLCanvasElement;
    private deviceLostHandler: ((info: GPUDeviceLostInfo) => void) | null = null;

    private constructor() { }

    static async init(canvas: HTMLCanvasElement): Promise<WebGPUContext> {
        // Validate canvas
        if (!canvas) {
            throw new Error('Canvas element is required but was not provided');
        }

        if (!(canvas instanceof HTMLCanvasElement)) {
            throw new Error('Provided element is not a valid HTMLCanvasElement');
        }

        // Check WebGPU support
        if (!navigator.gpu) {
            const userAgent = navigator.userAgent;
            let browserInfo = 'Unknown browser';

            if (userAgent.includes('Chrome')) {
                const match = userAgent.match(/Chrome\/(\d+)/);
                const version = match ? parseInt(match[1]) : 0;
                browserInfo = `Chrome ${version}`;

                if (version < 113) {
                    throw new WebGPUNotSupportedError(
                        `WebGPU requires Chrome 113+. You are using ${browserInfo}. ` +
                        'Please update your browser or enable WebGPU flag at chrome://flags/#enable-webgpu'
                    );
                }
            } else if (userAgent.includes('Edge')) {
                const match = userAgent.match(/Edg\/(\d+)/);
                const version = match ? parseInt(match[1]) : 0;
                browserInfo = `Edge ${version}`;

                if (version < 113) {
                    throw new WebGPUNotSupportedError(
                        `WebGPU requires Edge 113+. You are using ${browserInfo}. ` +
                        'Please update your browser.'
                    );
                }
            }

            throw new WebGPUNotSupportedError(
                `WebGPU is not supported in ${browserInfo}. ` +
                'Please use Chrome 113+ or Edge 113+ to run this application.'
            );
        }

        // Request GPU adapter
        let adapter: GPUAdapter | null;
        try {
            adapter = await navigator.gpu.requestAdapter({
                powerPreference: 'high-performance',
            });
        } catch (error) {
            throw new GPUAdapterError(
                `Failed to request GPU adapter: ${error instanceof Error ? error.message : String(error)}`
            );
        }

        if (!adapter) {
            throw new GPUAdapterError(
                'No GPU adapter found. This could mean:\n' +
                '1. Your GPU does not support WebGPU\n' +
                '2. GPU drivers are outdated (update your graphics drivers)\n' +
                '3. WebGPU is disabled in browser settings\n\n' +
                'Minimum GPU requirements:\n' +
                '- NVIDIA: GTX 1050 or newer\n' +
                '- AMD: RX 560 or newer\n' +
                '- Intel: Iris Xe or newer'
            );
        }

        // Request device
        let device: GPUDevice;
        try {
            device = await adapter.requestDevice({
                requiredFeatures: [],
                requiredLimits: {
                    maxTextureDimension2D: 4096,
                    maxBufferSize: 256 * 1024 * 1024, // 256MB
                },
            });
        } catch (error) {
            throw new GPUDeviceError(
                `Failed to create GPU device: ${error instanceof Error ? error.message : String(error)}. ` +
                'Your GPU may not meet the minimum requirements.'
            );
        }

        // Get WebGPU context
        const context = canvas.getContext('webgpu');
        if (!context) {
            throw new GPUDeviceError(
                'Failed to get WebGPU context from canvas. ' +
                'This should not happen if WebGPU is supported. ' +
                'Try reloading the page.'
            );
        }

        // Configure context
        const format = navigator.gpu.getPreferredCanvasFormat();
        try {
            context.configure({
                device,
                format,
                alphaMode: 'opaque',
                usage: GPUTextureUsage.RENDER_ATTACHMENT | GPUTextureUsage.COPY_SRC,
            });
        } catch (error) {
            throw new GPUDeviceError(
                `Failed to configure WebGPU context: ${error instanceof Error ? error.message : String(error)}`
            );
        }

        // Create instance
        const instance = new WebGPUContext();
        instance.device = device;
        instance.context = context;
        instance.canvas = canvas;

        // Handle device lost with detailed logging
        instance.deviceLostHandler = (info: GPUDeviceLostInfo) => {
            console.error('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
            console.error('⚠️  GPU DEVICE LOST');
            console.error('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
            console.error('Reason:', info.reason);
            console.error('Message:', info.message);

            if (info.reason === 'destroyed') {
                console.error('Device was intentionally destroyed.');
            } else if (info.reason === 'unknown') {
                console.error('Possible causes:');
                console.error('  - GPU driver crash');
                console.error('  - GPU was removed/disabled');
                console.error('  - Power management suspended GPU');
                console.error('  - System ran out of VRAM');
                console.error('\nRecommended actions:');
                console.error('  1. Update your GPU drivers');
                console.error('  2. Close other GPU-intensive applications');
                console.error('  3. Reduce video quality settings');
                console.error('  4. Restart your browser');
            }
            console.error('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
        };

        device.lost.then(instance.deviceLostHandler);

        // Log successful initialization
        console.log('[WebGPU] ✅ Initialized successfully');
        console.log('[WebGPU] Canvas format:', format);
        console.log('[WebGPU] Max texture dimension:', device.limits.maxTextureDimension2D);

        this.instance = instance;
        return instance;
    }

    static getInstance(): WebGPUContext | null {
        return this.instance;
    }

    /**
     * Clean up resources
     */
    destroy(): void {
        if (this.device) {
            console.log('[WebGPU] Destroying device...');
            this.device.destroy();
        }
        WebGPUContext.instance = null;
    }
}
