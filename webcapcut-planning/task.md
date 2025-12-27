# WebCapCut Implementation Task List

## 🧱 FASE 1: Fondasi Core Renderer ✅
**Tujuan:** Bisa memuat video & putar di canvas via WebCodecs + WebGPU

### Setup Proyek
- [x] Buat proyek dengan Vite + React + TypeScript
- [x] Install dependencies (mp4box, zustand, tailwindcss)
- [x] Konfigurasi TypeScript strict mode
- [x] Setup ESLint dan Prettier

### WebGPU Initialization
- [x] Inisialisasi WebGPU device & context (`navigator.gpu.requestAdapter()`)
- [x] Buat WebGPU canvas context
- [x] Handle error jika WebGPU tidak didukung
- [x] Implement device lost recovery

### Video Decoding Pipeline
- [x] Gunakan mp4box.js untuk parsing MP4
- [x] Ekstrak video samples dari MP4 container
- [x] Bangun VideoDecoder dengan WebCodecs API
- [x] Configure decoder dengan codec info dari MP4
- [x] Implement frame buffer management

### Render Loop
- [x] Buat loop requestAnimationFrame untuk mengambil VideoFrame
- [x] Render VideoFrame sebagai tekstur ke `<canvas>` via WebGPU
- [x] Tulis WGSL shader untuk texture sampling
- [x] **CRITICAL:** Pastikan `frame.close()` dipanggil tiap frame untuk hindari kebocoran VRAM
- [x] Implement FPS counter untuk monitoring

### Testing & Verification
- [/] Test dengan sample video MP4 (H.264)
- [/] Verify smooth playback (target 60fps)
- [/] Monitor VRAM usage (tidak boleh naik terus)
- [/] **Output:** File video diputar smooth di canvas (tanpa UI)

**🎯 FASE 1 SELESAI! Server running di http://localhost:5174**
**📝 Ready for user testing with sample MP4 video file**


---

## 🎮 FASE 2: State Management dan Playback Control ✅
**Tujuan:** Pisahkan UI dari render loop; dukung play/pause/seek

### Zustand Store Setup
- [x] Buat Zustand store: `{ isPlaying, currentTime, duration }` → `playbackStore.ts`
- [x] Gunakan selector granular di komponen UI
- [x] Implement transient updates untuk `currentTime` (subscribeWithSelector)
- [x] Add playback speed control state → `playbackRate`, `setPlaybackRate`

### Playback Controls
- [x] Buat komponen Play/Pause button → `PlaybackControls.tsx`
- [x] Implement time slider dengan DOM ref → `TimelineScrubber.tsx`
- [x] Playhead imperative update → `playheadRef.current.style.left`
- [x] Add keyboard shortcuts → `useKeyboardShortcuts.ts` (Space, Arrows, Home/End, K)

### Seeking Implementation
- [x] Implementasi seeking → HTMLVideoElement native seeking
- [x] Handle seeking saat video sedang playing (pauses on drag)
- [x] Implement scrubbing (drag playhead) → `TimelineScrubber.tsx`

### UI Components
- [x] Buat timeline ruler dengan timecode display → `TimelineRuler.tsx`
- [x] Add playback speed selector (0.25x-2x) → `SpeedSelector.tsx`
- [x] Display current time / duration → `TimeDisplay.tsx`
- [x] **Output:** Slider waktu + tombol play/pause berfungsi; video bisa di-skip

### Files Added:
```
src/store/playbackStore.ts       - Zustand state (isPlaying, currentTime, etc)
src/hooks/useKeyboardShortcuts.ts - Keyboard controls
src/ui/controls/PlaybackControls.tsx - Play/Pause button
src/ui/controls/SpeedSelector.tsx    - Speed dropdown
src/ui/timeline/TimelineScrubber.tsx - Drag playhead
src/ui/timeline/TimelineRuler.tsx    - Timecode ruler
src/ui/components/TimeDisplay.tsx    - Time formatting
```

**🎯 FASE 2 SELESAI!**

---

## 📊 FASE 3: Timeline Multi-Track & Klip Manipulation
**Tujuan:** Dukung drag-drop klip, multi-track, compositing

### Data Model
- [/] Definisikan model data TypeScript:
  ```typescript
  interface Clip { 
    id: string; 
    srcStart: number; 
    srcEnd: number; 
    timelineStart: number; 
    assetId: string; 
  }
  interface Track { 
    id: string; 
    clips: Clip[]; 
    type: 'video' | 'audio' 
  }
  ```
- [ ] Bangun struktur data efisien (IntervalTree) untuk query klip berdasarkan waktu → O(log n)
- [ ] Implement clip collision detection
- [ ] Add clip trimming data structure

### Timeline Visualization
- [ ] Visualisasi timeline dengan virtualisasi (hanya render klip dalam viewport)
- [ ] Implement horizontal scroll dengan zoom
- [ ] Render track headers (V1, V2, A1, etc.)
- [ ] Display clip thumbnails on timeline
- [ ] Show clip duration and labels

### Drag & Drop System
- [ ] Implement drag-and-drop untuk clips
- [ ] Snap to grid functionality
- [ ] Magnetic timeline (snap to other clips)
- [ ] Visual feedback during drag
- [ ] Support multi-track drag

### Compositing Engine
- [ ] Di engine render: loop baca semua klip aktif
- [ ] Decode frames dari multiple clips
- [ ] Composite via WebGPU (layer blending)
- [ ] Handle clip z-index/layering
- [ ] **Output:** Pengguna bisa drag & drop klip ke track; Picture-in-Picture berfungsi

---

## 🔊 FASE 4: Audio Sinkronisasi & Visualisasi ✅
**Tujuan:** Tambahkan audio, sinkronkan, tampilkan waveform

### Audio Pipeline
- [x] Setup AudioContext sebagai master clock
- [x] Sinkronisasi video mengikuti audio (`AudioContext.currentTime`)
- [x] Ekstrak audio samples dari MP4 dengan mp4box.js
- [x] Decode audio dengan WebCodecs AudioDecoder
- [x] Encode ke AudioBuffer untuk Web Audio API

### Audio Playback
- [x] Putar audio via AudioBufferSourceNode
- [x] Implement audio mixing untuk multiple tracks (multi-source playback)
- [ ] Add volume controls per track (hanya master gain saat ini)
- [x] Handle audio scrubbing (stop/start on seek)
- [x] Sync audio with video frame timestamps

### Multi-Clip Video Switching (Tambahan)
- [x] Buat MultiVideoManager untuk handle multiple video sources
- [x] Implement getActiveClips() untuk deteksi clip aktif per waktu
- [x] Switch video source dinamis saat playhead melewati boundary clip
- [x] Per-asset audio buffer dengan Map<assetId, AudioBuffer>
- [x] Multi-track audio: multiple AudioBufferSourceNodes bersamaan

### Waveform Visualization
- [x] Hitung audio peaks untuk visualisasi waveform
- [x] Gunakan `<canvas>` untuk render waveform (bukan DOM)
- [x] Di timeline, render waveform sebagai bagian dari klip
- [x] Optimize waveform rendering (downsample untuk zoom out)
- [ ] Color-code waveform by volume (nice-to-have)

### Testing
- [x] Test audio/video sync dengan berbagai video
- [x] Verify sync saat seeking
- [x] Test dengan multiple audio tracks (overlap working)
- [x] **Output:** Audio & video sinkron; waveform muncul di timeline

### Files Added/Modified:
```
src/core/AudioSystem.ts         - Multi-track audio (activeSources Map)
src/core/AudioDecoderManager.ts - WebCodecs audio decoder
src/core/MultiVideoManager.ts   - Multiple video source switching
src/core/MP4Parser.ts           - Audio track extraction
src/ui/VideoPlayer.tsx          - Multi-clip sync + updateActiveClips()
src/ui/components/WaveformDisplay.tsx - Canvas waveform renderer
```

**🎯 FASE 4 SELESAI! ~90% complete**
**📝 Sisa: Per-track volume, Color-coded waveform (nice-to-have)**


---

## 🎨 FASE 5: Efek Visual & Ekspor Video
**Tujuan:** Filter real-time + ekspor MP4 beresolusi tinggi

### Shader Effects
- [ ] Tulis shader WGSL untuk efek (brightness, contrast, grayscale)
- [ ] Implement color correction shaders
- [ ] Add blur effect (Gaussian, two-pass)
- [ ] Create transition shaders (fade, dissolve, wipe)
- [ ] Buat UI untuk ubah parameter shader (gunakan uniform buffer)

### Effect Pipeline
- [ ] Build effect chain system
- [ ] Implement ping-pong textures untuk multi-pass effects
- [ ] Add effect presets
- [ ] Real-time preview dengan effects
- [ ] Optimize shader performance

### Export Manager
- [ ] Buat ExportManager class
- [ ] Loop frame-by-frame (offline render)
- [ ] Setiap frame di-render → dikirim ke VideoEncoder
- [ ] Encode audio dengan AudioEncoder
- [ ] Gunakan mp4-muxer untuk gabung video + audio jadi file MP4

### Export Features
- [ ] Simpan ke disk via FileSystemWritableFileStream (atau OPFS → unduh)
- [ ] Add export progress bar dengan ETA
- [ ] Support export presets (1080p, 4K, YouTube, Instagram)
- [ ] Implement export cancellation
- [ ] Add export quality settings (bitrate, codec)

### Testing & Verification
- [ ] Test export dengan berbagai resolusi
- [ ] Verify audio/video sync di exported file
- [ ] Test dengan effects applied
- [ ] **Output:** Pengguna bisa ekspor video dengan efek yang diterapkan

---

## ⚠️ CRITICAL CHALLENGES - Ongoing Mitigation

### Kompatibilitas Codec
- [ ] Deteksi dengan `VideoDecoder.isConfigSupported()`
- [ ] Jika gagal → transkode via FFmpeg.wasm ke H.264/AAC
- [ ] Show user-friendly error messages
- [ ] Implement codec fallback chain

### Kebocoran Memori
- [ ] Implementasi Resource Manager yang lacak semua VideoFrame
- [ ] Track GPUTexture allocations
- [ ] Track AudioBuffer allocations
- [ ] Tutup eksplisit semua resources
- [ ] Add memory usage monitoring
- [ ] Implement automatic cleanup on threshold

### Desinkronisasi Audio/Video
- [ ] Gunakan microsecond integer time secara internal
- [ ] Sinkronkan ke `AudioContext.currentTime`
- [ ] Implement drift correction
- [ ] Add sync offset adjustment
- [ ] Test dengan berbagai video formats

### UI Lag pada Timeline
- [ ] Virtualisasi timeline (render hanya visible clips)
- [ ] Update DOM imperative untuk playhead → jangan biarkan React render 60x/detik
- [ ] Use `requestAnimationFrame` untuk smooth updates
- [ ] Debounce expensive operations
- [ ] Implement worker threads untuk heavy calculations
