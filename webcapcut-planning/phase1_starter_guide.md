# 🚀 WebCapCut - Phase 1 Starter Guide

## Quick Start: Get Video Playing in 1-2 Hours

This guide will walk you through implementing **Fase 1: Fondasi Core Renderer** step by step.

---

## Prerequisites

✅ **Browser:** Chrome 106+ or Edge 106+ (latest version recommended)  
✅ **Node.js:** v18+ (check with `node --version`)  
✅ **GPU:** Any modern GPU from 2018+ (integrated or discrete)  
✅ **Sample Video:** Have a small MP4 file ready (H.264 codec, < 100MB recommended)

---

## Step 1: Create Project (5 minutes)

### 1.1 Initialize Vite Project

```bash
# Navigate to your projects directory
cd C:\Users\cbsv0\OneDrive\ondrive\Dokumen\GITHUB

# Create new Vite project
npm create vite@latest webcapcut -- --template react-ts

# Navigate into project
cd webcapcut

# Install base dependencies
npm install
```

### 1.2 Install Additional Dependencies

```bash
# Media processing
npm install mp4box
npm install -D @types/mp4box

# State management (for Phase 2, but install now)
npm install zustand

# Styling
npm install -D tailwindcss postcss autoprefixer
npx tailwindcss init -p
```

### 1.3 Configure Vite for WebGPU

Edit `vite.config.ts`:

```typescript
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import path from 'path'

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
  server: {
    headers: {
      // Required for SharedArrayBuffer (FFmpeg.wasm in Phase 6)
      'Cross-Origin-Opener-Policy': 'same-origin',
      'Cross-Origin-Embedder-Policy': 'require-corp',
    },
  },
  optimizeDeps: {
    exclude: ['mp4box'], // Prevent Vite from pre-bundling
  },
})
```

### 1.4 Configure TypeScript

Edit `tsconfig.json` to enable strict mode:

```json
{
  "compilerOptions": {
    "target": "ES2020",
    "useDefineForClassFields": true,
    "lib": ["ES2020", "DOM", "DOM.Iterable", "WebWorker"],
    "module": "ESNext",
    "skipLibCheck": true,
    "strict": true,
    "noUnusedLocals": true,
    "noUnusedParameters": true,
    "noFallthroughCasesInSwitch": true,
    "moduleResolution": "bundler",
    "allowImportingTsExtensions": true,
    "resolveJsonModule": true,
    "isolatedModules": true,
    "noEmit": true,
    "jsx": "react-jsx",
    "baseUrl": ".",
    "paths": {
      "@/*": ["./src/*"]
    }
  },
  "include": ["src"],
  "references": [{ "path": "./tsconfig.node.json" }]
}
```

---

## Step 2: Create Core Rendering Engine (30 minutes)

### 2.1 Create Directory Structure

```bash
mkdir -p src/core/shaders
mkdir -p src/ui
mkdir -p src/types
```

### 2.2 Create Type Definitions

Create `src/types/video.ts`:

```typescript
export interface VideoConfig {
  codec: string;
  codedWidth: number;
  codedHeight: number;
  description?: Uint8Array;
}

export interface MP4Sample {
  is_sync: boolean;
  cts: number;
  duration: number;
  data: ArrayBuffer;
}
```

### 2.3 Create WebGPU Context Manager

Create `src/core/WebGPUContext.ts`:

```typescript
export class WebGPUContext {
  private static instance: WebGPUContext | null = null;
  public device!: GPUDevice;
  public context!: GPUCanvasContext;
  public canvas!: HTMLCanvasElement;

  private constructor() {}

  static async init(canvas: HTMLCanvasElement): Promise<WebGPUContext> {
    if (!navigator.gpu) {
      throw new Error(
        'WebGPU not supported. Please use Chrome 106+ or Edge 106+'
      );
    }

    const adapter = await navigator.gpu.requestAdapter();
    if (!adapter) {
      throw new Error('No GPU adapter found. Your GPU may not support WebGPU.');
    }

    const device = await adapter.requestDevice();
    const context = canvas.getContext('webgpu');
    if (!context) {
      throw new Error('Failed to get WebGPU context from canvas');
    }

    const format = navigator.gpu.getPreferredCanvasFormat();
    context.configure({
      device,
      format,
      alphaMode: 'opaque',
    });

    // Handle device lost
    device.lost.then((info) => {
      console.error('GPU device lost:', info.message);
      console.error('Reason:', info.reason);
    });

    const instance = new WebGPUContext();
    instance.device = device;
    instance.context = context;
    instance.canvas = canvas;

    this.instance = instance;
    return instance;
  }

  static getInstance(): WebGPUContext | null {
    return this.instance;
  }
}
```

### 2.4 Create MP4 Parser

Create `src/core/MP4Parser.ts`:

```typescript
import MP4Box, { MP4File, MP4Info, MP4ArrayBuffer } from 'mp4box';
import { VideoConfig, MP4Sample } from '../types/video';

export class MP4Parser {
  private mp4box: MP4File;
  private videoConfig: VideoConfig | null = null;
  private videoTrackId: number = 0;

  constructor() {
    this.mp4box = MP4Box.createFile();
  }

  async parse(file: File): Promise<VideoConfig> {
    return new Promise((resolve, reject) => {
      this.mp4box.onReady = (info: MP4Info) => {
        console.log('MP4 Info:', info);

        const videoTrack = info.videoTracks[0];
        if (!videoTrack) {
          reject(new Error('No video track found in MP4 file'));
          return;
        }

        this.videoTrackId = videoTrack.id;

        // Extract codec string (e.g., "avc1.42E01E" for H.264)
        const codec = videoTrack.codec;

        this.videoConfig = {
          codec,
          codedWidth: videoTrack.track_width,
          codedHeight: videoTrack.track_height,
        };

        console.log('Video config:', this.videoConfig);
        resolve(this.videoConfig);
      };

      this.mp4box.onError = (e: string) => {
        reject(new Error(`MP4Box error: ${e}`));
      };

      // Read file as ArrayBuffer
      const reader = new FileReader();
      reader.onload = (e) => {
        const arrayBuffer = e.target!.result as ArrayBuffer;
        const mp4ArrayBuffer = arrayBuffer as MP4ArrayBuffer;
        mp4ArrayBuffer.fileStart = 0;

        this.mp4box.appendBuffer(mp4ArrayBuffer);
        this.mp4box.flush();
      };

      reader.onerror = () => {
        reject(new Error('Failed to read file'));
      };

      reader.readAsArrayBuffer(file);
    });
  }

  extractSamples(onSample: (sample: MP4Sample) => void): void {
    this.mp4box.setExtractionOptions(this.videoTrackId, null, {
      nbSamples: 1000,
    });

    this.mp4box.onSamples = (_trackId: number, _user: any, samples: any[]) => {
      samples.forEach((sample) => {
        onSample({
          is_sync: sample.is_sync,
          cts: sample.cts,
          duration: sample.duration,
          data: sample.data,
        });
      });
    };

    this.mp4box.start();
  }
}
```

### 2.5 Create Video Decoder Manager

Create `src/core/VideoDecoderManager.ts`:

```typescript
import { VideoConfig, MP4Sample } from '../types/video';

export class VideoDecoderManager {
  private decoder: VideoDecoder | null = null;
  private frameBuffer: VideoFrame[] = [];
  private maxBufferSize = 30; // ~0.5s at 60fps
  private currentTimestamp = 0;

  async init(config: VideoConfig): Promise<void> {
    // Check codec support
    const support = await VideoDecoder.isConfigSupported({
      codec: config.codec,
      codedWidth: config.codedWidth,
      codedHeight: config.codedHeight,
    });

    if (!support.supported) {
      throw new Error(
        `Codec ${config.codec} not supported by this browser. ` +
        `Try converting your video to H.264 (avc1.42E01E).`
      );
    }

    console.log('Codec support:', support);

    this.decoder = new VideoDecoder({
      output: (frame) => this.onFrame(frame),
      error: (e) => {
        console.error('VideoDecoder error:', e);
      },
    });

    this.decoder.configure({
      codec: config.codec,
      codedWidth: config.codedWidth,
      codedHeight: config.codedHeight,
      description: config.description,
    });

    console.log('VideoDecoder initialized');
  }

  decode(sample: MP4Sample): void {
    if (!this.decoder) {
      console.error('Decoder not initialized');
      return;
    }

    const chunk = new EncodedVideoChunk({
      type: sample.is_sync ? 'key' : 'delta',
      timestamp: sample.cts,
      duration: sample.duration,
      data: sample.data,
    });

    this.decoder.decode(chunk);
  }

  private onFrame(frame: VideoFrame): void {
    this.frameBuffer.push(frame);

    // **CRITICAL:** Limit buffer size to prevent VRAM leak
    if (this.frameBuffer.length > this.maxBufferSize) {
      const oldFrame = this.frameBuffer.shift();
      if (oldFrame) {
        oldFrame.close(); // Release VRAM!
        console.log('Closed old frame, buffer size:', this.frameBuffer.length);
      }
    }
  }

  getNextFrame(): VideoFrame | null {
    return this.frameBuffer.length > 0 ? this.frameBuffer[0] : null;
  }

  getFrameAt(timestamp: number): VideoFrame | null {
    return (
      this.frameBuffer.find(
        (f) => f.timestamp !== null && Math.abs(f.timestamp - timestamp) < 16666
      ) || null
    );
  }

  destroy(): void {
    console.log('Destroying VideoDecoderManager...');
    
    // **CRITICAL:** Clean up all frames
    this.frameBuffer.forEach((f) => f.close());
    this.frameBuffer = [];

    if (this.decoder) {
      this.decoder.close();
      this.decoder = null;
    }

    console.log('VideoDecoderManager destroyed');
  }
}
```

### 2.6 Create WGSL Shader

Create `src/core/shaders/video.wgsl`:

```wgsl
@group(0) @binding(0) var mySampler: sampler;
@group(0) @binding(1) var myTexture: texture_external;

struct VertexOutput {
  @builtin(position) position: vec4<f32>,
  @location(0) texCoord: vec2<f32>,
}

@vertex
fn vs_main(@builtin(vertex_index) vertexIndex: u32) -> VertexOutput {
  // Full-screen quad vertices
  var pos = array<vec2<f32>, 4>(
    vec2<f32>(-1.0, -1.0),  // Bottom-left
    vec2<f32>(1.0, -1.0),   // Bottom-right
    vec2<f32>(-1.0, 1.0),   // Top-left
    vec2<f32>(1.0, 1.0),    // Top-right
  );
  
  // Texture coordinates (flipped Y for video)
  var uv = array<vec2<f32>, 4>(
    vec2<f32>(0.0, 1.0),
    vec2<f32>(1.0, 1.0),
    vec2<f32>(0.0, 0.0),
    vec2<f32>(1.0, 0.0),
  );
  
  var output: VertexOutput;
  output.position = vec4<f32>(pos[vertexIndex], 0.0, 1.0);
  output.texCoord = uv[vertexIndex];
  return output;
}

@fragment
fn fs_main(input: VertexOutput) -> @location(0) vec4<f32> {
  return textureSampleBaseClampToEdge(myTexture, mySampler, input.texCoord);
}
```

### 2.7 Create Canvas Renderer

Create `src/core/CanvasRenderer.ts`:

```typescript
import { WebGPUContext } from './WebGPUContext';

export class CanvasRenderer {
  private pipeline: GPURenderPipeline | null = null;
  private sampler: GPUSampler | null = null;
  private animationId: number | null = null;
  private frameCount = 0;
  private lastFpsUpdate = performance.now();
  private fps = 0;

  async init(gpu: WebGPUContext, shaderCode: string): Promise<void> {
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

    console.log('CanvasRenderer initialized');
  }

  startRenderLoop(
    gpu: WebGPUContext,
    getFrame: () => VideoFrame | null
  ): void {
    const render = () => {
      const frame = getFrame();

      if (frame) {
        this.renderFrame(gpu, frame);
        
        // **CRITICAL:** Close frame to release VRAM!
        frame.close();
      }

      // Update FPS counter
      this.frameCount++;
      const now = performance.now();
      if (now - this.lastFpsUpdate >= 1000) {
        this.fps = this.frameCount;
        console.log(`FPS: ${this.fps}`);
        this.frameCount = 0;
        this.lastFpsUpdate = now;
      }

      this.animationId = requestAnimationFrame(render);
    };

    render();
  }

  private renderFrame(gpu: WebGPUContext, frame: VideoFrame): void {
    if (!this.pipeline || !this.sampler) {
      console.error('Renderer not initialized');
      return;
    }

    // Import VideoFrame as external texture
    const videoTexture = gpu.device.importExternalTexture({
      source: frame,
      label: 'Video Frame Texture',
    });

    const commandEncoder = gpu.device.createCommandEncoder({
      label: 'Render Command Encoder',
    });

    const textureView = gpu.context.getCurrentTexture().createView();

    const renderPass = commandEncoder.beginRenderPass({
      colorAttachments: [
        {
          view: textureView,
          loadOp: 'clear',
          storeOp: 'store',
          clearValue: { r: 0, g: 0, b: 0, a: 1 },
        },
      ],
      label: 'Video Render Pass',
    });

    renderPass.setPipeline(this.pipeline);

    const bindGroup = gpu.device.createBindGroup({
      layout: this.pipeline.getBindGroupLayout(0),
      entries: [
        { binding: 0, resource: this.sampler },
        { binding: 1, resource: videoTexture },
      ],
      label: 'Video Bind Group',
    });

    renderPass.setBindGroup(0, bindGroup);
    renderPass.draw(4); // Draw full-screen quad
    renderPass.end();

    gpu.device.queue.submit([commandEncoder.finish()]);
  }

  stop(): void {
    if (this.animationId !== null) {
      cancelAnimationFrame(this.animationId);
      this.animationId = null;
    }
    console.log('Render loop stopped');
  }

  getFPS(): number {
    return this.fps;
  }
}
```

---

## Step 3: Create UI Component (15 minutes)

### 3.1 Create Video Player Component

Create `src/ui/VideoPlayer.tsx`:

```typescript
import { useEffect, useRef, useState } from 'react';
import { WebGPUContext } from '../core/WebGPUContext';
import { MP4Parser } from '../core/MP4Parser';
import { VideoDecoderManager } from '../core/VideoDecoderManager';
import { CanvasRenderer } from '../core/CanvasRenderer';
import videoShaderCode from '../core/shaders/video.wgsl?raw';

interface VideoPlayerProps {
  videoFile: File;
}

export function VideoPlayer({ videoFile }: VideoPlayerProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [status, setStatus] = useState<string>('Initializing...');
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let renderer: CanvasRenderer | null = null;
    let decoder: VideoDecoderManager | null = null;

    async function init() {
      try {
        const canvas = canvasRef.current;
        if (!canvas) {
          throw new Error('Canvas not found');
        }

        setStatus('Initializing WebGPU...');
        const gpu = await WebGPUContext.init(canvas);

        setStatus('Parsing MP4 file...');
        const parser = new MP4Parser();
        const config = await parser.parse(videoFile);

        setStatus('Initializing video decoder...');
        decoder = new VideoDecoderManager();
        await decoder.init(config);

        setStatus('Extracting video samples...');
        parser.extractSamples((sample) => {
          decoder!.decode(sample);
        });

        setStatus('Starting render loop...');
        renderer = new CanvasRenderer();
        await renderer.init(gpu, videoShaderCode);
        renderer.startRenderLoop(gpu, () => decoder!.getNextFrame());

        setStatus('Playing video...');
      } catch (err) {
        const errorMessage = err instanceof Error ? err.message : String(err);
        console.error('Initialization error:', errorMessage);
        setError(errorMessage);
        setStatus('Error');
      }
    }

    init();

    // Cleanup on unmount
    return () => {
      console.log('Cleaning up VideoPlayer...');
      renderer?.stop();
      decoder?.destroy();
    };
  }, [videoFile]);

  return (
    <div className="flex flex-col items-center gap-4 p-4">
      <div className="text-sm font-mono">
        Status: <span className="font-bold">{status}</span>
      </div>
      
      {error && (
        <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded">
          <strong>Error:</strong> {error}
        </div>
      )}

      <canvas
        ref={canvasRef}
        width={1920}
        height={1080}
        className="max-w-full h-auto border border-gray-300 rounded shadow-lg"
      />
    </div>
  );
}
```

### 3.2 Update Main App

Replace `src/App.tsx`:

```typescript
import { useState } from 'react';
import { VideoPlayer } from './ui/VideoPlayer';

function App() {
  const [file, setFile] = useState<File | null>(null);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = e.target.files?.[0];
    if (selectedFile) {
      console.log('Selected file:', selectedFile.name);
      setFile(selectedFile);
    }
  };

  return (
    <div className="min-h-screen bg-gray-900 text-white">
      <header className="bg-gray-800 p-4 shadow-lg">
        <h1 className="text-2xl font-bold">WebCapCut - Phase 1 Demo</h1>
        <p className="text-sm text-gray-400">Core Renderer Foundation</p>
      </header>

      <main className="container mx-auto p-8">
        <div className="bg-gray-800 rounded-lg p-6 mb-6">
          <label className="block mb-2 text-sm font-medium">
            Select MP4 Video File (H.264 codec recommended):
          </label>
          <input
            type="file"
            accept="video/mp4,video/quicktime"
            onChange={handleFileChange}
            className="block w-full text-sm text-gray-400 file:mr-4 file:py-2 file:px-4 file:rounded file:border-0 file:text-sm file:font-semibold file:bg-blue-600 file:text-white hover:file:bg-blue-700 cursor-pointer"
          />
        </div>

        {file && <VideoPlayer videoFile={file} />}
      </main>
    </div>
  );
}

export default App;
```

### 3.3 Update Tailwind Config

Replace `tailwind.config.js`:

```javascript
/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {},
  },
  plugins: [],
}
```

### 3.4 Update CSS

Replace `src/index.css`:

```css
@tailwind base;
@tailwind components;
@tailwind utilities;

body {
  margin: 0;
  font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', 'Roboto', 'Oxygen',
    'Ubuntu', 'Cantarell', 'Fira Sans', 'Droid Sans', 'Helvetica Neue',
    sans-serif;
  -webkit-font-smoothing: antialiased;
  -moz-osx-font-smoothing: grayscale;
}

code {
  font-family: source-code-pro, Menlo, Monaco, Consolas, 'Courier New',
    monospace;
}
```

---

## Step 4: Run and Test (10 minutes)

### 4.1 Start Development Server

```bash
npm run dev
```

Open browser to `http://localhost:5173`

### 4.2 Test with Sample Video

1. Click "Choose File"
2. Select an MP4 video (H.264 codec)
3. Watch the status messages
4. Video should start playing automatically

### 4.3 Monitor Performance

Open Chrome DevTools:
- **Console:** Check for FPS logs (should be ~60fps)
- **Performance Monitor:** GPU memory should be stable (~100-200MB)
- **Task Manager:** Chrome task should not grow indefinitely

---

## Troubleshooting

### "WebGPU not supported"
- Update Chrome/Edge to latest version
- Check `chrome://gpu` - WebGPU should be enabled

### "Codec not supported"
- Your video might use HEVC/H.265
- Convert to H.264: `ffmpeg -i input.mp4 -c:v libx264 -preset fast output.mp4`

### Video not playing / black screen
- Check browser console for errors
- Verify video file is valid MP4
- Try a different video file

### Memory leak / browser crash
- Check that `frame.close()` is being called (see console logs)
- Reduce `maxBufferSize` in VideoDecoderManager

---

## Success Criteria ✅

- [ ] Video loads without errors
- [ ] Video plays smoothly at 60fps
- [ ] Console shows FPS logs
- [ ] GPU memory stays stable (not growing)
- [ ] No errors in console

---

## Next Steps

Once Phase 1 is working:
1. **Phase 2:** Add play/pause controls and seeking
2. **Phase 3:** Implement timeline and multi-track support
3. **Phase 4:** Add audio synchronization
4. **Phase 5:** Implement effects and export

---

## Need Help?

Common issues and solutions:
- **TypeScript errors:** Run `npm install` again
- **Import errors:** Check file paths are correct
- **WGSL shader errors:** Check syntax in browser console
- **Performance issues:** Try smaller video file first

Good luck! 🚀
