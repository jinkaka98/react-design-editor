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

## 📊 FASE 3: Timeline Multi-Track & Klip Manipulation ✅
**Tujuan:** Dukung drag-drop klip, multi-track, compositing

### Data Model
- [x] Definisikan model data TypeScript → `types/timeline.ts`
  ```typescript
  interface ClipData { id, assetId, srcStart, srcEnd, type }
  interface ClipSegment { id, clipId, start, duration }
  interface Track { id, type, clips: ClipSegment[], muted, locked }
  interface Asset { id, name, duration, file, type }
  ```
- [x] Query klip berdasarkan waktu → `getActiveClips(currentTime)`
- [x] Clip collision detection → `insertClipAtTime()` checks gaps
- [x] Clip trimming data → segment.start/duration based

### Timeline Visualization
- [x] Timeline dengan scroll/zoom → `Timeline.tsx`, `zoom` + `scrollX` state
- [x] Horizontal scroll dengan zoom → `setZoom()`, `setScrollX()`
- [x] Render track headers (V1, A1, etc.) → `TimelineTrack.tsx`
- [x] Clip visualization → `TimelineClip.tsx`
- [x] Gap visualization → `TimelineGap.tsx`

### Drag & Drop System
- [x] Drag-and-drop clips → `useDragClip.ts` hook
- [x] Snap to grid → `snapInterval` parameter
- [x] Visual feedback (preview rect during drag)
- [x] Cross-track drag → `moveClip(fromTrack, toTrack, segmentId, newStart)`

### Compositing/Playback
- [x] Loop semua klip aktif → `getActiveClips(currentTime)` 
- [x] Switch video source dinamis → `MultiVideoManager.ts`
- [x] Multi-clip audio playback → `audioSystem.updateActiveClips()`
- [x] **Output:** Drag & drop klip berfungsi; multi-clip switching

### Files Added:
```
src/store/timelineStore.ts    - Track/Clip CRUD, zoom, scroll (315 lines)
src/types/timeline.ts         - Type definitions + helpers
src/hooks/useDragClip.ts      - Drag system with snap
src/ui/timeline/Timeline.tsx  - Main timeline container
src/ui/timeline/TimelineTrack.tsx  - Track row
src/ui/timeline/TimelineClip.tsx   - Clip visualization
src/ui/timeline/TimelineGap.tsx    - Gap between clips
src/core/MultiVideoManager.ts - Multiple video sources
```

**🎯 FASE 3 SELESAI!**

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

## 🎨 FASE 5: Efek Visual & Ekspor Video ✅ (Export Done)
**Tujuan:** Filter real-time + ekspor MP4 beresolusi tinggi

### Shader Effects (Phase 5B - Deferred)
- [ ] Tulis shader WGSL untuk efek (brightness, contrast, grayscale)
- [ ] Implement color correction shaders
- [ ] Add blur effect (Gaussian, two-pass)
- [ ] Create transition shaders (fade, dissolve, wipe)
- [ ] Buat UI untuk ubah parameter shader (gunakan uniform buffer)

### Effect Pipeline (Phase 5B - Deferred)
- [ ] Build effect chain system
- [ ] Implement ping-pong textures untuk multi-pass effects
- [ ] Add effect presets
- [ ] Real-time preview dengan effects
- [ ] Optimize shader performance

### Export Manager ✅
- [x] Buat ExportManager class → `ExportManager.ts`
- [x] Loop frame-by-frame (offline render via OffscreenCanvas)
- [x] Setiap frame di-render → dikirim ke VideoEncoder (WebCodecs)
- [x] Encode audio dengan AudioEncoder → AudioData chunks
- [x] Gunakan mp4-muxer untuk gabung video + audio jadi file MP4

### Export Features ✅
- [x] Simpan ke disk via Blob → download link
- [x] Add export progress bar → ExportDialog dengan persen
- [x] Support export presets (720p, 1080p, 1080p-vertical)
- [x] Implement export cancellation → `cancel()` method
- [x] Add export quality settings (bitrate, codec) → ExportOptions

### Export UI ✅
- [x] ExportDialog modal dengan preset selection
- [x] Progress bar dengan stage indicator
- [x] Download button setelah complete
- [x] Export button di header App

### Files Added:
```
src/core/ExportManager.ts        - WebCodecs encoder + mp4-muxer (~300 lines)
src/ui/export/ExportDialog.tsx   - Export UI modal
src/types/video.ts               - ExportOptions, ExportPreset, EXPORT_PRESETS
```

### Testing & Verification
- [x] Build successful (473KB)
- [ ] Test export dengan berbagai resolusi
- [ ] Verify audio/video sync di exported file
- [ ] **Output:** Pengguna bisa ekspor video ke MP4

**🎯 FASE 5A (Export) SELESAI!**
**📝 Next: FASE 5B (Shader Effects) atau testing export**


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
