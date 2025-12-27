import { useCallback, useState } from 'react';
import { VideoPlayer } from './ui/VideoPlayer';
import { Timeline } from './ui/timeline/Timeline';
import { useTimelineStore } from './store/timelineStore';
import { generateId, getTrackDuration } from './types/timeline';
import { ResolutionDropdown } from './ui/controls/ResolutionSelector';
import {
  validateVideoFile,
  validateVideoElement,
  generateUniqueAssetName,
  formatFileSize
} from './utils/validation';
import { MP4Parser } from './core/MP4Parser';
import { AudioDecoderManager } from './core/AudioDecoderManager';
import { audioSystem } from './core/AudioSystem';
import { multiVideoManager } from './core/MultiVideoManager';
import { MP4Sample } from './types/video';
import { ExportDialog } from './ui/export/ExportDialog';

function App() {
  const addAsset = useTimelineStore(state => state.addAsset);
  const addClip = useTimelineStore(state => state.addClip);
  const tracks = useTimelineStore(state => state.tracks);
  const assets = useTimelineStore(state => state.assets);

  const [isLoading, setIsLoading] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [isExportOpen, setIsExportOpen] = useState(false);

  const handleFileChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = e.target.files?.[0];
    if (!selectedFile) return;

    // Clear previous error
    setLoadError(null);

    // Validate file first
    const fileValidation = validateVideoFile(selectedFile);
    if (!fileValidation.valid) {
      setLoadError(fileValidation.error || 'Invalid file');
      console.error('[App] File validation failed:', fileValidation.error);
      return;
    }

    if (fileValidation.warnings) {
      fileValidation.warnings.forEach(w => console.warn('[App] Warning:', w));
    }

    console.log('[App] Selected file:', selectedFile.name, formatFileSize(selectedFile.size));
    setIsLoading(true);

    // Process audio in parallel
    // Generate assetId early so we can use it for both audio and video
    const assetId = generateId();

    const processAudio = async () => {
      try {
        console.log('[App] Starting audio processing...');
        const parser = new MP4Parser();
        const { audio } = await parser.parse(selectedFile);

        if (audio) {
          console.log('[App] Audio track found, extracting...');
          const samples = await new Promise<MP4Sample[]>((resolve) => {
            parser.startAudioExtraction(resolve);
          });

          console.log(`[App] Extracted ${samples.length} audio samples. Decoding...`);
          const decoder = new AudioDecoderManager();
          const buffer = await decoder.decode(audio, samples);

          console.log('[App] Audio decoded, duration:', buffer.duration.toFixed(2), 's');
          // Use per-asset audio buffer
          audioSystem.addAudioBuffer(assetId, buffer);
        } else {
          console.log('[App] No audio track found.');
        }
      } catch (e) {
        console.error('[App] Audio processing failed:', e);
      }
    };

    // Fire and forget audio processing (will complete eventually)
    processAudio();

    // Create a video element and load it fully
    const video = document.createElement('video');
    video.preload = 'auto';
    video.muted = true;
    video.playsInline = true;
    video.crossOrigin = 'anonymous';
    video.src = URL.createObjectURL(selectedFile);

    // Flag to prevent duplicate adds
    let isAdded = false;

    // Wait for video to be fully ready
    const handleVideoReady = () => {
      if (isAdded) return; // Prevent duplicate
      isAdded = true;

      // Validate loaded video
      const videoValidation = validateVideoElement(video);
      if (!videoValidation.valid) {
        setLoadError(videoValidation.error || 'Video validation failed');
        setIsLoading(false);
        URL.revokeObjectURL(video.src);
        console.error('[App] Video validation failed:', videoValidation.error);
        return;
      }

      if (videoValidation.warnings) {
        videoValidation.warnings.forEach(w => console.warn('[App] Warning:', w));
      }

      const duration = video.duration * 1_000_000;

      // Generate unique name if duplicate
      const uniqueName = generateUniqueAssetName(selectedFile.name, assets);

      console.log('[App] Video ready:', video.videoWidth, 'x', video.videoHeight,
        'duration:', video.duration.toFixed(2), 's');

      // Add asset to store
      addAsset({
        id: assetId,
        name: uniqueName,
        type: 'video',
        duration,
        file: selectedFile,
        videoElement: video,
      });

      // Also register with MultiVideoManager
      multiVideoManager.loadVideo(assetId, selectedFile).catch(err => {
        console.error('[App] MultiVideoManager load failed:', err);
      });

      // Add clip to first video track
      const videoTrack = tracks.find(t => t.type === 'video');
      if (videoTrack) {
        // Calculate start position (after last segment)
        const lastClipEnd = getTrackDuration(videoTrack);

        addClip(videoTrack.id, {
          assetId,
          srcStart: 0,
          srcEnd: duration,
          // @ts-expect-error - timelineStart is handled internally by store
          timelineStart: lastClipEnd,
        });
      }

      setIsLoading(false);
      console.log('[App] ✅ Added asset and clip:', assetId);
    };

    video.oncanplaythrough = handleVideoReady;

    video.onerror = () => {
      if (isAdded) return;
      const errorMsg = video.error?.message || 'Unknown video error';
      setLoadError(`Failed to load video: ${errorMsg}`);
      setIsLoading(false);
      URL.revokeObjectURL(video.src);
      console.error('[App] Video load error:', errorMsg);
    };

    // Timeout for slow loads
    setTimeout(() => {
      if (!isAdded && isLoading) {
        setLoadError('Video loading timeout. File may be too large or corrupted.');
        setIsLoading(false);
        URL.revokeObjectURL(video.src);
      }
    }, 30000); // 30 second timeout

    video.load();

    // Reset file input so same file can be selected again
    e.target.value = '';
  }, [addAsset, addClip, tracks, assets, isLoading]);

  const hasClips = tracks.some(t => t.segments.some(s => s.type === 'clip'));

  return (
    <div className="h-screen flex flex-col bg-gray-900 text-white overflow-hidden">
      {/* Header */}
      <header className="bg-gray-800 px-4 py-3 shadow-lg flex-shrink-0 border-b border-gray-700">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-xl font-bold">WebCapCut</h1>
            <p className="text-xs text-gray-400">Multi-Track Video Editor</p>
          </div>

          {/* Actions */}
          <div className="flex items-center gap-3">
            {/* Resolution selector */}
            <ResolutionDropdown />

            <span className="text-xs text-gray-500">
              {assets.size} assets, {tracks.reduce((sum, t) => sum + t.segments.filter(s => s.type === 'clip').length, 0)} clips
            </span>

            <label className={`cursor-pointer px-4 py-2 rounded text-sm font-medium transition-colors
                            ${isLoading
                ? 'bg-gray-600 cursor-wait'
                : 'bg-blue-600 hover:bg-blue-500'}`}>
              {isLoading ? '⏳ Loading...' : '+ Add Video'}
              <input
                type="file"
                accept="video/mp4,video/quicktime,video/webm"
                onChange={handleFileChange}
                className="hidden"
                disabled={isLoading}
              />
            </label>

            {/* Export Button */}
            <button
              onClick={() => setIsExportOpen(true)}
              disabled={!hasClips}
              className={`px-4 py-2 rounded text-sm font-medium transition-colors flex items-center gap-2
                          ${hasClips
                  ? 'bg-green-600 hover:bg-green-500'
                  : 'bg-gray-600 cursor-not-allowed opacity-50'}`}
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" />
              </svg>
              Export
            </button>
          </div>
        </div>

        {/* Error message */}
        {loadError && (
          <div className="mt-2 px-3 py-2 bg-red-600/20 border border-red-500 rounded text-sm text-red-300 flex items-center gap-2">
            <span>⚠️</span>
            <span>{loadError}</span>
            <button
              onClick={() => setLoadError(null)}
              className="ml-auto text-red-300 hover:text-white"
            >
              ✕
            </button>
          </div>
        )}
      </header>

      {/* Main content */}
      <main className="flex-1 flex flex-col overflow-hidden">
        {/* Preview area */}
        <div className="flex-1 flex items-center justify-center bg-black min-h-0 overflow-hidden">
          {hasClips ? (
            <VideoPlayer />
          ) : (
            <div className="text-gray-500 text-center">
              <svg className="w-16 h-16 mx-auto mb-4 opacity-50" fill="currentColor" viewBox="0 0 20 20">
                <path d="M2 6a2 2 0 012-2h6a2 2 0 012 2v8a2 2 0 01-2 2H4a2 2 0 01-2-2V6zM14.553 7.106A1 1 0 0014 8v4a1 1 0 00.553.894l2 1A1 1 0 0018 13V7a1 1 0 00-1.447-.894l-2 1z" />
              </svg>
              <p className="text-lg mb-2">No videos yet</p>
              <p className="text-sm">Click "+ Add Video" to get started</p>
              <p className="text-xs mt-4 text-gray-600">Supported: MP4, WebM, MOV (max 500MB)</p>
            </div>
          )}
        </div>

        {/* Timeline */}
        <div className="h-48 flex-shrink-0 border-t border-gray-700">
          <Timeline />
        </div>
      </main>

      {/* Export Dialog */}
      <ExportDialog isOpen={isExportOpen} onClose={() => setIsExportOpen(false)} />
    </div>
  );
}

export default App;
