# WebCapCut - Browser-Based Video Editor Implementation Plan

A professional-grade web video editor built with WebGPU, WebCodecs, React, and TypeScript.

## User Review Required

> [!IMPORTANT]
> **Browser Compatibility Limitation**
> This application will **only support Chromium-based browsers** (Chrome ≥ v106, Edge ≥ v106). Firefox and Safari do not currently support the combination of WebGPU + WebCodecs required for this project.

> [!WARNING]
> **Hardware Requirements**
> Users will need:
> - A GPU that supports WebGPU (most modern GPUs from 2018+)
> - Minimum 8GB RAM (16GB recommended for 4K editing)
> - Modern CPU with hardware video decode support

> [!IMPORTANT]
> **Project Location**
> This will be created as a **new project** in a separate directory, not in the existing `Aqua-Creator` workspace. Please confirm the desired project location.

> [!CAUTION]
> **Critical Memory Management**
> Failure to call `frame.close()` on every VideoFrame will cause VRAM leaks and browser crashes. This is the #1 cause of failures in WebCodecs applications.

---

## ⚠️ PENANGANAN TANTANGAN KRITIS

Before diving into implementation, here are the critical challenges and mitigation strategies:

| Tantangan | Strategi Mitigasi | Implementation Priority |
|-----------|-------------------|------------------------|
| **Kompatibilitas Codec** | Deteksi dengan `VideoDecoder.isConfigSupported()`. Jika gagal → transkode via FFmpeg.wasm ke H.264/AAC. | Phase 1 & 6 |
| **Kebocoran Memori** | Implementasi Resource Manager yang lacak semua VideoFrame, GPUTexture, dan AudioBuffer. Tutup eksplisit. | Phase 1 (CRITICAL) |
| **Desinkronisasi Audio/Video** | Gunakan microsecond integer time secara internal; sinkronkan ke `AudioContext.currentTime`. | Phase 4 |
| **UI Lag pada Timeline** | Virtualisasi + update DOM imperative untuk playhead → jangan biarkan React render 60x/detik. | Phase 2 & 3 |

---

## Proposed Changes

### 🧱 FASE 1: Fondasi Core Renderer
**Tujuan:** Bisa memuat video & putar di canvas via WebCodecs + WebGPU

**Output:** File video diputar smooth di canvas (tanpa UI)

#### Langkah Teknis

##### 1. Buat Proyek dengan Vite + React + TypeScript

###### [NEW] [package.json](file:///C:/Users/cbsv0/OneDrive/ondrive/Dokumen/GITHUB/webcapcut/package.json)
```bash
npm create vite@latest webcapcut -- --template react-ts
```
- Core dependencies:
  - `react` ^18.3.0, `react-dom` ^18.3.0
  - `typescript` ^5.6.0
  - `vite` ^5.4.0
  - `@vitejs/plugin-react` ^4.3.0
- Media processing:
  - `mp4box` ^0.5.2 (MP4 demuxing)
  - `@types/mp4box` (TypeScript types)
- State management:
  - `zustand` ^4.5.0
- Styling:
  - `tailwindcss` ^3.4.0
  - `autoprefixer`, `postcss`
- Dev tools:
  - `eslint`, `prettier`, `vitest`

###### [NEW] [vite.config.ts](file:///C:/Users/cbsv0/OneDrive/ondrive/Dokumen/GITHUB/webcapcut/vite.config.ts)
- Configure React plugin
- Enable source maps for debugging
- **CRITICAL:** Set COOP/COEP headers for SharedArrayBuffer support (needed for FFmpeg.wasm later):
  ```typescript
  server: {
    headers: {
      'Cross-Origin-Opener-Policy': 'same-origin',
      'Cross-Origin-Embedder-Policy': 'require-corp'
    }
  }
  ```

###### [NEW] [tsconfig.json](file:///C:/Users/cbsv0/OneDrive/ondrive/Dokumen/GITHUB/webcapcut/tsconfig.json)
- Enable strict mode
- Add DOM and WebWorker lib types
- Configure path aliases: `@/` → `src/`

---

##### 2. Inisialisasi WebGPU Device & Context

###### [NEW] [src/core/WebGPUContext.ts](file:///C:/Users/cbsv0/OneDrive/ondrive/Dokumen/GITHUB/webcapcut/src/core/WebGPUContext.ts)
```typescript
class WebGPUContext {
  private static instance: WebGPUContext;
  public device!: GPUDevice;
  public context!: GPUCanvasContext;
  
  static async init(canvas: HTMLCanvasElement): Promise<WebGPUContext> {
    if (!navigator.gpu) {
      throw new Error('WebGPU not supported');
    }
    
    const adapter = await navigator.gpu.requestAdapter();
    if (!adapter) throw new Error('No GPU adapter found');
    
    const device = await adapter.requestDevice();
    const context = canvas.getContext('webgpu')!;
    
    context.configure({
      device,
      format: navigator.gpu.getPreferredCanvasFormat(),
      alphaMode: 'opaque',
    });
    
    // Handle device lost
    device.lost.then((info) => {
      console.error('GPU device lost:', info);
    });
    
    this.instance = new WebGPUContext();
    this.instance.device = device;
    this.instance.context = context;
    
    return this.instance;
  }
}
```

---

##### 3. Gunakan mp4box.js untuk Parsing MP4 → Ekstrak Video Samples

###### [NEW] [src/core/MP4Parser.ts](file:///C:/Users/cbsv0/OneDrive/ondrive/Dokumen/GITHUB/webcapcut/src/core/MP4Parser.ts)
```typescript
import MP4Box from 'mp4box';

interface VideoConfig {
  codec: string;
  codedWidth: number;
  codedHeight: number;
  description?: Uint8Array;
}

class MP4Parser {
  private mp4box: any;
  private videoConfig?: VideoConfig;
  
  async parse(file: File): Promise<VideoConfig> {
    return new Promise((resolve, reject) => {
      this.mp4box = MP4Box.createFile();
      
      this.mp4box.onReady = (info: any) => {
        const videoTrack = info.videoTracks[0];
        if (!videoTrack) {
          reject(new Error('No video track found'));
          return;
        }
        
        this.videoConfig = {
          codec: videoTrack.codec,
          codedWidth: videoTrack.track_width,
          codedHeight: videoTrack.track_height,
          description: this.extractDescription(videoTrack),
        };
        
        resolve(this.videoConfig);
      };
      
      this.mp4box.onError = reject;
      
      // Read file as ArrayBuffer
      const reader = new FileReader();
      reader.onload = (e) => {
        const buffer = e.target!.result as ArrayBuffer;
        buffer.fileStart = 0;
        this.mp4box.appendBuffer(buffer);
        this.mp4box.flush();
      };
      reader.readAsArrayBuffer(file);
    });
  }
  
  extractSamples(trackId: number, onSample: (sample: any) => void) {
    this.mp4box.setExtractionOptions(trackId, null, { nbSamples: 1000 });
    this.mp4box.onSamples = (id: number, user: any, samples: any[]) => {
      samples.forEach(onSample);
    };
    this.mp4box.start();
  }
}
```

---

##### 4. Bangun VideoDecoder dan Loop requestAnimationFrame

###### [NEW] [src/core/VideoDecoderManager.ts](file:///C:/Users/cbsv0/OneDrive/ondrive/Dokumen/GITHUB/webcapcut/src/core/VideoDecoderManager.ts)
```typescript
class VideoDecoderManager {
  private decoder!: VideoDecoder;
  private frameBuffer: VideoFrame[] = [];
  private maxBufferSize = 30; // ~0.5s at 60fps
  
  async init(config: VideoConfig) {
    // Check codec support
    const support = await VideoDecoder.isConfigSupported({
      codec: config.codec,
      codedWidth: config.codedWidth,
      codedHeight: config.codedHeight,
    });
    
    if (!support.supported) {
      throw new Error(`Codec ${config.codec} not supported`);
    }
    
    this.decoder = new VideoDecoder({
      output: (frame) => this.onFrame(frame),
      error: (e) => console.error('Decoder error:', e),
    });
    
    this.decoder.configure(config);
  }
  
  decode(sample: any) {
    const chunk = new EncodedVideoChunk({
      type: sample.is_sync ? 'key' : 'delta',
      timestamp: sample.cts,
      duration: sample.duration,
      data: sample.data,
    });
    
    this.decoder.decode(chunk);
  }
  
  private onFrame(frame: VideoFrame) {
    this.frameBuffer.push(frame);
    
    // **CRITICAL:** Limit buffer size to prevent VRAM leak
    if (this.frameBuffer.length > this.maxBufferSize) {
      const oldFrame = this.frameBuffer.shift();
      oldFrame?.close(); // Release VRAM!
    }
  }
  
  getFrameAt(timestamp: number): VideoFrame | null {
    return this.frameBuffer.find(f => 
      Math.abs(f.timestamp! - timestamp) < 16666
    ) || null;
  }
  
  destroy() {
    // **CRITICAL:** Clean up all frames
    this.frameBuffer.forEach(f => f.close());
    this.frameBuffer = [];
    this.decoder.close();
  }
}
```

---

##### 5. Render VideoFrame sebagai Tekstur ke Canvas via WebGPU

###### [NEW] [src/core/CanvasRenderer.ts](file:///C:/Users/cbsv0/OneDrive/ondrive/Dokumen/GITHUB/webcapcut/src/core/CanvasRenderer.ts)
```typescript
class CanvasRenderer {
  private pipeline!: GPURenderPipeline;
  private sampler!: GPUSampler;
  private animationId?: number;
  
  async init(gpu: WebGPUContext, shaderCode: string) {
    const shaderModule = gpu.device.createShaderModule({ code: shaderCode });
    
    this.pipeline = gpu.device.createRenderPipeline({
      layout: 'auto',
      vertex: {
        module: shaderModule,
        entryPoint: 'vs_main',
      },
      fragment: {
        module: shaderModule,
        entryPoint: 'fs_main',
        targets: [{ format: navigator.gpu.getPreferredCanvasFormat() }],
      },
      primitive: { topology: 'triangle-strip' },
    });
    
    this.sampler = gpu.device.createSampler({
      magFilter: 'linear',
      minFilter: 'linear',
    });
  }
  
  startRenderLoop(
    gpu: WebGPUContext,
    getFrame: () => VideoFrame | null
  ) {
    const render = () => {
      const frame = getFrame();
      if (!frame) {
        this.animationId = requestAnimationFrame(render);
        return;
      }
      
      // Import VideoFrame as external texture
      const videoTexture = gpu.device.importExternalTexture({ source: frame });
      
      const commandEncoder = gpu.device.createCommandEncoder();
      const textureView = gpu.context.getCurrentTexture().createView();
      
      const renderPass = commandEncoder.beginRenderPass({
        colorAttachments: [{
          view: textureView,
          loadOp: 'clear',
          storeOp: 'store',
          clearValue: { r: 0, g: 0, b: 0, a: 1 },
        }],
      });
      
      renderPass.setPipeline(this.pipeline);
      
      const bindGroup = gpu.device.createBindGroup({
        layout: this.pipeline.getBindGroupLayout(0),
        entries: [
          { binding: 0, resource: this.sampler },
          { binding: 1, resource: videoTexture },
        ],
      });
      
      renderPass.setBindGroup(0, bindGroup);
      renderPass.draw(4); // Full-screen quad
      renderPass.end();
      
      gpu.device.queue.submit([commandEncoder.finish()]);
      
      // **CRITICAL:** Close frame to release VRAM!
      frame.close();
      
      this.animationId = requestAnimationFrame(render);
    };
    
    render();
  }
  
  stop() {
    if (this.animationId) {
      cancelAnimationFrame(this.animationId);
    }
  }
}
```

###### [NEW] [src/core/shaders/video.wgsl](file:///C:/Users/cbsv0/OneDrive/ondrive/Dokumen/GITHUB/webcapcut/src/core/shaders/video.wgsl)
```wgsl
@group(0) @binding(0) var mySampler: sampler;
@group(0) @binding(1) var myTexture: texture_external;

struct VertexOutput {
  @builtin(position) position: vec4<f32>,
  @location(0) texCoord: vec2<f32>,
}

@vertex
fn vs_main(@builtin(vertex_index) vertexIndex: u32) -> VertexOutput {
  var pos = array<vec2<f32>, 4>(
    vec2<f32>(-1.0, -1.0),
    vec2<f32>(1.0, -1.0),
    vec2<f32>(-1.0, 1.0),
    vec2<f32>(1.0, 1.0),
  );
  
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

---

##### 6. Pastikan frame.close() Dipanggil Tiap Frame

**CRITICAL IMPLEMENTATION NOTES:**

> [!CAUTION]
> **Memory Leak Prevention**
> Every `VideoFrame` object holds GPU memory (VRAM). Failing to call `frame.close()` will cause:
> - VRAM usage to grow indefinitely
> - Browser tab crash after ~30 seconds of playback
> - GPU driver instability

**Checklist untuk setiap VideoFrame:**
- ✅ Call `frame.close()` immediately after rendering
- ✅ Call `frame.close()` when removing from buffer
- ✅ Call `frame.close()` in cleanup/destroy methods
- ✅ Use try-finally blocks to ensure cleanup
- ✅ Monitor VRAM usage in Chrome DevTools

---

##### 7. Basic UI Component

###### [NEW] [src/ui/VideoPlayer.tsx](file:///C:/Users/cbsv0/OneDrive/ondrive/Dokumen/GITHUB/webcapcut/src/ui/VideoPlayer.tsx)
```typescript
import { useEffect, useRef } from 'react';
import { WebGPUContext } from '../core/WebGPUContext';
import { MP4Parser } from '../core/MP4Parser';
import { VideoDecoderManager } from '../core/VideoDecoderManager';
import { CanvasRenderer } from '../core/CanvasRenderer';
import videoShader from '../core/shaders/video.wgsl?raw';

export function VideoPlayer({ videoFile }: { videoFile: File }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  
  useEffect(() => {
    let renderer: CanvasRenderer;
    let decoder: VideoDecoderManager;
    
    async function init() {
      const canvas = canvasRef.current!;
      const gpu = await WebGPUContext.init(canvas);
      
      // Parse MP4
      const parser = new MP4Parser();
      const config = await parser.parse(videoFile);
      
      // Initialize decoder
      decoder = new VideoDecoderManager();
      await decoder.init(config);
      
      // Extract and decode samples
      parser.extractSamples(1, (sample) => decoder.decode(sample));
      
      // Start rendering
      renderer = new CanvasRenderer();
      await renderer.init(gpu, videoShader);
      renderer.startRenderLoop(gpu, () => decoder.getFrameAt(Date.now() * 1000));
    }
    
    init();
    
    return () => {
      renderer?.stop();
      decoder?.destroy();
    };
  }, [videoFile]);
  
  return <canvas ref={canvasRef} width={1920} height={1080} />;
}
```

###### [NEW] [src/main.tsx](file:///C:/Users/cbsv0/OneDrive/ondrive/Dokumen/GITHUB/webcapcut/src/main.tsx)
```typescript
import React from 'react';
import ReactDOM from 'react-dom/client';
import { VideoPlayer } from './ui/VideoPlayer';

function App() {
  const [file, setFile] = React.useState<File | null>(null);
  
  return (
    <div>
      <input type="file" accept="video/*" onChange={(e) => setFile(e.target.files?.[0] || null)} />
      {file && <VideoPlayer videoFile={file} />}
    </div>
  );
}

ReactDOM.createRoot(document.getElementById('root')!).render(<App />);
```

---

### 🎮 FASE 2: State Management dan Playback Control

#### State Management Architecture

##### [NEW] [src/store/timelineStore.ts](file:///C:/Users/cbsv0/OneDrive/ondrive/Dokumen/GITHUB/webcapcut/src/store/timelineStore.ts)
- Zustand store for timeline state
- Data structures:
  ```typescript
  interface Clip {
    id: string;
    trackId: string;
    startTime: number;
    duration: number;
    trimStart: number;
    trimEnd: number;
    mediaSource: MediaSource;
  }
  
  interface Track {
    id: string;
    type: 'video' | 'audio';
    clips: Clip[];
    locked: boolean;
    visible: boolean;
  }
  ```
- Actions: addClip, removeClip, moveClip, trimClip, addTrack, removeTrack
- Selectors for efficient re-renders

##### [NEW] [src/store/playbackStore.ts](file:///C:/Users/cbsv0/OneDrive/ondrive/Dokumen/GITHUB/webcapcut/src/store/playbackStore.ts)
- Playback state (playing, paused, currentTime)
- Playback speed control
- Loop region settings
- Transient updates for currentTime (avoid re-renders)

---

#### Timeline UI Components

##### [NEW] [src/ui/timeline/Timeline.tsx](file:///C:/Users/cbsv0/OneDrive/ondrive/Dokumen/GITHUB/webcapcut/src/ui/timeline/Timeline.tsx)
- Main timeline container
- Virtualized rendering (only render visible clips)
- Scroll synchronization (horizontal for time, vertical for tracks)
- Zoom controls (pixels per second)

##### [NEW] [src/ui/timeline/TimelineRuler.tsx](file:///C:/Users/cbsv0/OneDrive/ondrive/Dokumen/GITHUB/webcapcut/src/ui/timeline/TimelineRuler.tsx)
- Time ruler with tick marks
- Display timecodes (HH:MM:SS:FF)
- Snap-to-grid functionality

##### [NEW] [src/ui/timeline/TrackHeader.tsx](file:///C:/Users/cbsv0/OneDrive/ondrive/Dokumen/GITHUB/webcapcut/src/ui/timeline/TrackHeader.tsx)
- Track label (V1, V2, A1, etc.)
- Lock/unlock toggle
- Visibility toggle
- Track height resize handle

##### [NEW] [src/ui/timeline/ClipItem.tsx](file:///C:/Users/cbsv0/OneDrive/ondrive/Dokumen/GITHUB/webcapcut/src/ui/timeline/ClipItem.tsx)
- Visual representation of clip on timeline
- Drag to move clip
- Resize handles for trimming
- Thumbnail preview strip
- Waveform overlay for audio clips

##### [NEW] [src/ui/timeline/Playhead.tsx](file:///C:/Users/cbsv0/OneDrive/ondrive/Dokumen/GITHUB/webcapcut/src/ui/timeline/Playhead.tsx)
- Red vertical line indicating current time
- Draggable to scrub timeline
- Synchronized with playback

---

#### Drag & Drop System

##### [NEW] [src/utils/dnd.ts](file:///C:/Users/cbsv0/OneDrive/ondrive/Dokumen/GITHUB/webcapcut/src/utils/dnd.ts)
- Custom drag-and-drop implementation (not using HTML5 DnD for performance)
- Handle clip dragging between tracks
- Snap to other clips
- Magnetic timeline (snap to playhead)
- Visual feedback during drag

---

### Phase 3: Audio System 🔊

#### Audio Pipeline

##### [NEW] [src/core/AudioDecoder.ts](file:///C:/Users/cbsv0/OneDrive/ondrive/Dokumen/GITHUB/webcapcut/src/core/AudioDecoder.ts)
- Wrap WebCodecs AudioDecoder API
- Extract audio track from MP4 using mp4box.js
- Decode audio samples to AudioData
- Convert to PCM format for Web Audio API

##### [NEW] [src/core/AudioMixer.ts](file:///C:/Users/cbsv0/OneDrive/ondrive/Dokumen/GITHUB/webcapcut/src/core/AudioMixer.ts)
- Create Web Audio API context
- Implement multi-track audio mixing
- Synchronize audio with video playback
- Handle volume and pan controls per track
- Apply audio effects (gain, EQ, compression)

##### [NEW] [src/core/AudioWorkletProcessor.ts](file:///C:/Users/cbsv0/OneDrive/ondrive/Dokumen/GITHUB/webcapcut/src/core/AudioWorkletProcessor.ts)
- Custom AudioWorklet for precise audio timing
- Buffer audio samples from decoder
- Synchronize with video frame timestamps
- Handle audio scrubbing

---

#### Waveform Visualization

##### [NEW] [src/utils/waveform.ts](file:///C:/Users/cbsv0/OneDrive/ondrive/Dokumen/GITHUB/webcapcut/src/utils/waveform.ts)
- Generate waveform peaks from audio data
- Downsample for efficient rendering
- Cache waveform data per clip
- Render waveform on canvas (or SVG)

##### [NEW] [src/ui/timeline/WaveformRenderer.tsx](file:///C:/Users/cbsv0/OneDrive/ondrive/Dokumen/GITHUB/webcapcut/src/ui/timeline/WaveformRenderer.tsx)
- Display waveform overlay on audio clips
- Color-coded by volume
- Responsive to zoom level

---

### Phase 4: Effects & Compositing 🎨

#### WebGPU Shader Pipeline

##### [NEW] [src/core/EffectPipeline.ts](file:///C:/Users/cbsv0/OneDrive/ondrive/Dokumen/GITHUB/webcapcut/src/core/EffectPipeline.ts)
- Manage multiple render passes
- Chain effects together
- Ping-pong between textures for multi-pass effects
- Optimize by combining compatible effects

##### [NEW] [src/core/effects/BaseEffect.ts](file:///C:/Users/cbsv0/OneDrive/ondrive/Dokumen/GITHUB/webcapcut/src/core/effects/BaseEffect.ts)
- Abstract base class for all effects
- Define interface: `apply(inputTexture, outputTexture, params)`
- Handle uniform buffer updates

---

#### Built-in Effects

##### [NEW] [src/core/effects/TransitionEffect.ts](file:///C:/Users/cbsv0/OneDrive/ondrive/Dokumen/GITHUB/webcapcut/src/core/effects/TransitionEffect.ts)
- Fade, dissolve, wipe transitions
- WGSL shaders for each transition type
- Configurable duration and easing

##### [NEW] [src/core/effects/ColorCorrection.ts](file:///C:/Users/cbsv0/OneDrive/ondrive/Dokumen/GITHUB/webcapcut/src/core/effects/ColorCorrection.ts)
- Brightness, contrast, saturation, hue
- Exposure, highlights, shadows
- Color grading LUT support

##### [NEW] [src/core/effects/Transform.ts](file:///C:/Users/cbsv0/OneDrive/ondrive/Dokumen/GITHUB/webcapcut/src/core/effects/Transform.ts)
- Scale, rotate, position
- Crop and aspect ratio
- Keyframe animation support

##### [NEW] [src/core/effects/BlurEffect.ts](file:///C:/Users/cbsv0/OneDrive/ondrive/Dokumen/GITHUB/webcapcut/src/core/effects/BlurEffect.ts)
- Gaussian blur (two-pass separable)
- Configurable radius
- Optimized for real-time preview

---

#### Text & Graphics Overlay

##### [NEW] [src/core/TextRenderer.ts](file:///C:/Users/cbsv0/OneDrive/ondrive/Dokumen/GITHUB/webcapcut/src/core/TextRenderer.ts)
- Render text to canvas
- Convert to WebGPU texture
- Support fonts, colors, outlines, shadows
- Animated text effects

##### [NEW] [src/ui/effects/EffectsPanel.tsx](file:///C:/Users/cbsv0/OneDrive/ondrive/Dokumen/GITHUB/webcapcut/src/ui/effects/EffectsPanel.tsx)
- UI for browsing and applying effects
- Real-time preview
- Effect parameter controls
- Preset management

---

### Phase 5: Export System 📤

#### Video Encoding

##### [NEW] [src/core/VideoEncoder.ts](file:///C:/Users/cbsv0/OneDrive/ondrive/Dokumen/GITHUB/webcapcut/src/core/VideoEncoder.ts)
- Wrap WebCodecs VideoEncoder API
- Configure codec (H.264, VP9, AV1)
- Set bitrate, resolution, framerate
- Encode rendered frames from canvas
- Handle encoder output (EncodedVideoChunk)

##### [NEW] [src/core/AudioEncoder.ts](file:///C:/Users/cbsv0/OneDrive/ondrive/Dokumen/GITHUB/webcapcut/src/core/AudioEncoder.ts)
- Wrap WebCodecs AudioEncoder API
- Encode mixed audio to AAC or Opus
- Synchronize with video encoder

---

#### Muxing & Export

##### [NEW] [src/core/Muxer.ts](file:///C:/Users/cbsv0/OneDrive/ondrive/Dokumen/GITHUB/webcapcut/src/core/Muxer.ts)
- Use `mp4-muxer` or `webm-muxer`
- Combine encoded video and audio chunks
- Write to file (download or OPFS)
- Handle metadata (duration, resolution, etc.)

##### [NEW] [src/workers/exportWorker.ts](file:///C:/Users/cbsv0/OneDrive/ondrive/Dokumen/GITHUB/webcapcut/src/workers/exportWorker.ts)
- Offload export to Web Worker
- Prevent UI blocking during export
- Report progress via postMessage
- Handle cancellation

---

#### Export UI

##### [NEW] [src/ui/controls/ExportDialog.tsx](file:///C:/Users/cbsv0/OneDrive/ondrive/Dokumen/GITHUB/webcapcut/src/ui/controls/ExportDialog.tsx)
- Export settings form:
  - Resolution (1080p, 4K, custom)
  - Framerate (24, 30, 60 fps)
  - Codec (H.264, VP9, AV1)
  - Bitrate (CBR, VBR, quality presets)
  - Audio settings
- Export presets (YouTube, Instagram, TikTok)
- Progress bar and ETA
- Cancel button

---

### Phase 6: File Management & Storage 💾

#### Media Library

##### [NEW] [src/store/mediaStore.ts](file:///C:/Users/cbsv0/OneDrive/ondrive/Dokumen/GITHUB/webcapcut/src/store/mediaStore.ts)
- Store imported media files
- Track file metadata (duration, resolution, codec)
- Generate thumbnails
- Organize into folders/collections

##### [NEW] [src/core/MediaImporter.ts](file:///C:/Users/cbsv0/OneDrive/ondrive/Dokumen/GITHUB/webcapcut/src/core/MediaImporter.ts)
- Handle file input and drag-drop
- Validate file types (MP4, MOV, WebM, etc.)
- Extract metadata using mp4box.js
- Store in OPFS for large files
- Generate proxy files if needed

##### [NEW] [src/ui/MediaLibrary.tsx](file:///C:/Users/cbsv0/OneDrive/ondrive/Dokumen/GITHUB/webcapcut/src/ui/MediaLibrary.tsx)
- Grid view of imported media
- Thumbnail previews
- Search and filter
- Drag media to timeline

---

#### Project Persistence

##### [NEW] [src/core/ProjectManager.ts](file:///C:/Users/cbsv0/OneDrive/ondrive/Dokumen/GITHUB/webcapcut/src/core/ProjectManager.ts)
- Save/load project files (JSON format)
- Include timeline state, clips, effects, settings
- Store in OPFS or IndexedDB
- Auto-save every 30 seconds
- Export/import project files

##### [NEW] [src/utils/opfs.ts](file:///C:/Users/cbsv0/OneDrive/ondrive/Dokumen/GITHUB/webcapcut/src/utils/opfs.ts)
- Wrapper for Origin Private File System API
- Store large media files without RAM overhead
- Handle file read/write operations
- Clean up unused files

---

### Phase 7: Advanced Features ⚡

#### FFmpeg.wasm Fallback

##### [NEW] [src/core/FFmpegTranscoder.ts](file:///C:/Users/cbsv0/OneDrive/ondrive/Dokumen/GITHUB/webcapcut/src/core/FFmpegTranscoder.ts)
- Load FFmpeg.wasm on demand
- Transcode unsupported formats (MKV, HEVC, ProRes)
- Convert to browser-compatible codec (H.264)
- Run in Web Worker to avoid blocking UI
- Show progress during transcoding

---

#### Proxy Generation

##### [NEW] [src/workers/proxyWorker.ts](file:///C:/Users/cbsv0/OneDrive/ondrive/Dokumen/GITHUB/webcapcut/src/workers/proxyWorker.ts)
- Generate lower-resolution proxy files for 4K+ media
- Use WebCodecs or FFmpeg.wasm
- Store proxies in OPFS
- Switch between proxy and original for export

---

#### Keyframe Animation

##### [NEW] [src/core/KeyframeEngine.ts](file:///C:/Users/cbsv0/OneDrive/ondrive/Dokumen/GITHUB/webcapcut/src/core/KeyframeEngine.ts)
- Define keyframe data structure
- Interpolation (linear, ease-in/out, bezier)
- Animate any effect parameter over time
- Keyframe editor UI in timeline

---

#### Undo/Redo System

##### [NEW] [src/store/historyStore.ts](file:///C:/Users/cbsv0/OneDrive/ondrive/Dokumen/GITHUB/webcapcut/src/store/historyStore.ts)
- Command pattern for all actions
- Undo/redo stack
- Keyboard shortcuts (Ctrl+Z, Ctrl+Y)
- Limit history size to prevent memory issues

---

### Phase 8: Polish & Optimization ✨

#### Performance Optimization

##### [MODIFY] [src/core/CanvasRenderer.ts](file:///C:/Users/cbsv0/OneDrive/ondrive/Dokumen/GITHUB/webcapcut/src/core/CanvasRenderer.ts)
- Implement object pooling for VideoFrames
- Reduce GPU texture allocations
- Batch render commands
- Profile with Chrome DevTools GPU profiler

##### [NEW] [src/utils/performanceMonitor.ts](file:///C:/Users/cbsv0/OneDrive/ondrive/Dokumen/GITHUB/webcapcut/src/utils/performanceMonitor.ts)
- Track FPS, frame drops
- Monitor VRAM usage
- Log decoder/encoder performance
- Display stats overlay (dev mode)

---

#### Error Handling

##### [NEW] [src/utils/errorHandler.ts](file:///C:/Users/cbsv0/OneDrive/ondrive/Dokumen/GITHUB/webcapcut/src/utils/errorHandler.ts)
- Global error boundary
- Graceful degradation for unsupported features
- User-friendly error messages
- Automatic recovery where possible

---

#### UI/UX Polish

##### [NEW] [src/ui/Onboarding.tsx](file:///C:/Users/cbsv0/OneDrive/ondrive/Dokumen/GITHUB/webcapcut/src/ui/Onboarding.tsx)
- First-time user tutorial
- Keyboard shortcuts guide
- Sample project templates

##### [NEW] [src/styles/tailwind.config.js](file:///C:/Users/cbsv0/OneDrive/ondrive/Dokumen/GITHUB/webcapcut/src/styles/tailwind.config.js)
- Custom theme (dark mode by default)
- Professional color palette
- Consistent spacing and typography

##### [MODIFY] All UI components
- Add loading states
- Implement skeleton screens
- Add micro-interactions and animations
- Ensure responsive design (min 1280px width recommended)
- Accessibility: keyboard navigation, ARIA labels, screen reader support

---

## Verification Plan

### Automated Tests

#### Unit Tests (Vitest)
```bash
npm run test
```
- Test core utilities (time conversion, waveform generation)
- Test Zustand stores (actions, selectors)
- Test effect calculations
- Mock WebGPU/WebCodecs APIs

#### Integration Tests
- Test video decoding → rendering pipeline
- Test audio decoding → mixing → playback
- Test export workflow (encode → mux → download)
- Test project save/load

### Manual Verification

#### Phase 1 Verification
1. Load a sample MP4 file
2. Verify smooth playback on canvas (60fps target)
3. Check browser console for errors
4. Monitor VRAM usage (should not grow indefinitely)

#### Phase 2 Verification
1. Add multiple clips to timeline
2. Drag clips between tracks
3. Trim clips using handles
4. Verify playhead synchronization
5. Test zoom and scroll

#### Phase 3 Verification
1. Load video with audio
2. Verify audio/video sync during playback
3. Test volume controls
4. Verify waveform visualization
5. Test scrubbing (audio should follow)

#### Phase 4 Verification
1. Apply color correction to clip
2. Add transition between two clips
3. Add text overlay
4. Verify real-time preview performance
5. Test effect parameter changes

#### Phase 5 Verification
1. Export a simple 10-second timeline
2. Verify output file plays correctly
3. Check video/audio sync in exported file
4. Test different export presets
5. Verify progress reporting

#### Phase 6 Verification
1. Import multiple media files
2. Save project
3. Reload page and load project
4. Verify all clips and effects restored
5. Test auto-save functionality

#### Phase 7 Verification
1. Import unsupported format (if FFmpeg enabled)
2. Verify transcoding works
3. Test keyframe animation
4. Test undo/redo (10+ actions)
5. Verify proxy generation for 4K file

#### Phase 8 Verification
1. Run performance profiler during playback
2. Verify FPS stays above 30 (ideally 60)
3. Test error scenarios (invalid file, GPU lost)
4. Verify UI responsiveness
5. Test on different Chromium browsers (Chrome, Edge, Brave)

### Browser Compatibility Testing
- Chrome 106+ (primary target)
- Edge 106+
- Brave (Chromium-based)
- Verify WebGPU and WebCodecs support detection
- Display helpful error message on unsupported browsers

---

## Success Criteria

✅ **Phase 1:** Video plays smoothly on canvas without memory leaks  
✅ **Phase 2:** Timeline supports multi-track editing with drag-and-drop  
✅ **Phase 3:** Audio/video sync is maintained during playback and scrubbing  
✅ **Phase 4:** Effects can be applied and previewed in real-time  
✅ **Phase 5:** Export produces valid MP4 files with correct A/V sync  
✅ **Phase 6:** Projects can be saved and restored reliably  
✅ **Phase 7:** Advanced features work without degrading performance  
✅ **Phase 8:** Application feels polished and professional
