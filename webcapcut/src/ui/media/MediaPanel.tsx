/**
 * MediaPanel - Sidebar for managing uploaded media
 * With audio extraction support
 */
import { useCallback, useRef, useState } from 'react';
import { useTimelineStore } from '../../store/timelineStore';
import { MediaItem } from './MediaItem';
import { multiVideoManager } from '../../core/MultiVideoManager';
import { generateId } from '../../types/timeline';
import { validateVideoFile, validateVideoElement, generateUniqueAssetName, formatFileSize } from '../../utils/validation';
import { MP4Parser } from '../../core/MP4Parser';
import { AudioDecoderManager } from '../../core/AudioDecoderManager';
import { audioSystem } from '../../core/AudioSystem';
import type { MP4Sample } from '../../types/video';

interface MediaPanelProps {
    onAssetAdded?: (assetId: string) => void;
}

export function MediaPanel({ onAssetAdded }: MediaPanelProps) {
    const fileInputRef = useRef<HTMLInputElement>(null);
    const [isUploading, setIsUploading] = useState(false);
    const [selectedAssetId, setSelectedAssetId] = useState<string | null>(null);

    const assets = useTimelineStore(state => state.assets);
    const addAsset = useTimelineStore(state => state.addAsset);
    const removeAsset = useTimelineStore(state => state.removeAsset);
    const addClip = useTimelineStore(state => state.addClip);
    const tracks = useTimelineStore(state => state.tracks);

    const handleUploadClick = () => {
        fileInputRef.current?.click();
    };

    const handleFileChange = useCallback(async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;

        // Reset input
        e.target.value = '';

        // Validate
        const validation = validateVideoFile(file);
        if (!validation.valid) {
            console.error('[MediaPanel] Invalid file:', validation.error);
            return;
        }

        setIsUploading(true);
        console.log('[MediaPanel] Uploading:', file.name, formatFileSize(file.size));

        // Generate assetId early for both video and audio
        const assetId = generateId();

        try {
            // Process audio in parallel (fire and forget)
            const processAudio = async () => {
                try {
                    console.log('[MediaPanel] Starting audio processing...');
                    const parser = new MP4Parser();
                    const { audio } = await parser.parse(file);

                    if (audio) {
                        console.log('[MediaPanel] Audio track found, extracting...');
                        const samples = await new Promise<MP4Sample[]>((resolve) => {
                            parser.startAudioExtraction(resolve);
                        });

                        console.log(`[MediaPanel] Extracted ${samples.length} audio samples. Decoding...`);
                        const decoder = new AudioDecoderManager();
                        const buffer = await decoder.decode(audio, samples);

                        console.log('[MediaPanel] Audio decoded, duration:', buffer.duration.toFixed(2), 's');
                        audioSystem.addAudioBuffer(assetId, buffer);
                    } else {
                        console.log('[MediaPanel] No audio track found.');
                    }
                } catch (err) {
                    console.error('[MediaPanel] Audio processing failed:', err);
                }
            };

            // Start audio processing (don't await - parallel)
            processAudio();

            // Create video element
            const video = document.createElement('video');
            video.preload = 'auto';
            video.muted = true;
            video.playsInline = true;
            video.crossOrigin = 'anonymous';
            video.src = URL.createObjectURL(file);

            // Wait for video to be ready
            await new Promise<void>((resolve, reject) => {
                video.oncanplaythrough = () => resolve();
                video.onerror = () => reject(new Error('Failed to load video'));
                setTimeout(() => reject(new Error('Video load timeout')), 30000);
            });

            // Validate video element
            const videoValidation = validateVideoElement(video);
            if (!videoValidation.valid) {
                throw new Error(videoValidation.error);
            }

            // Generate unique name
            const uniqueName = generateUniqueAssetName(file.name, assets);

            // Create asset
            const durationMicros = video.duration * 1_000_000;

            const asset = {
                id: assetId,
                name: uniqueName,
                type: 'video' as const,
                duration: durationMicros,
                file: file,
                videoElement: video
            };

            // Register with video manager
            multiVideoManager.registerVideo(assetId, video);

            // Add to store
            addAsset(asset);
            setSelectedAssetId(assetId);
            onAssetAdded?.(assetId);

            console.log('[MediaPanel] ✅ Asset added:', assetId, uniqueName, (video.duration).toFixed(1) + 's');
        } catch (error) {
            console.error('[MediaPanel] Upload error:', error);
        } finally {
            setIsUploading(false);
        }
    }, [assets, addAsset, onAssetAdded]);

    const handleAddToTimeline = useCallback((assetId: string) => {
        const asset = assets.get(assetId);
        if (!asset) return;

        // Find video track or first track
        const videoTrack = tracks.find(t => t.type === 'video') || tracks[0];
        if (!videoTrack) {
            console.error('[MediaPanel] No track found');
            return;
        }

        // Add clip at the end of the track
        addClip(videoTrack.id, {
            assetId: asset.id,
            srcStart: 0,
            srcEnd: asset.duration
        });

        console.log('[MediaPanel] ✅ Added to timeline:', asset.name);
    }, [assets, tracks, addClip]);

    const handleDeleteAsset = useCallback((assetId: string) => {
        removeAsset(assetId);
        if (selectedAssetId === assetId) {
            setSelectedAssetId(null);
        }
        console.log('[MediaPanel] Deleted asset:', assetId);
    }, [removeAsset, selectedAssetId]);

    const assetList = Array.from(assets.values());

    return (
        <div className="w-52 bg-gray-900 border-r border-gray-700 flex flex-col h-full">
            {/* Header */}
            <div className="p-3 border-b border-gray-700">
                <h2 className="text-sm font-semibold text-gray-200 mb-2">Media</h2>
                <button
                    onClick={handleUploadClick}
                    disabled={isUploading}
                    className="w-full px-3 py-2 bg-blue-600 hover:bg-blue-700 disabled:bg-gray-600 text-white text-sm font-medium rounded-lg transition-colors flex items-center justify-center gap-2"
                >
                    {isUploading ? (
                        <>
                            <svg className="w-4 h-4 animate-spin" viewBox="0 0 24 24">
                                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                            </svg>
                            Uploading...
                        </>
                    ) : (
                        <>
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                            </svg>
                            Add Media
                        </>
                    )}
                </button>
                <input
                    ref={fileInputRef}
                    type="file"
                    accept="video/mp4,video/webm,video/quicktime,.mp4,.webm,.mov"
                    onChange={handleFileChange}
                    className="hidden"
                />
            </div>

            {/* Media list */}
            <div className="flex-1 overflow-y-auto p-2 space-y-2">
                {assetList.length === 0 ? (
                    <div className="text-center text-gray-500 text-sm py-8">
                        <svg className="w-10 h-10 mx-auto mb-2 opacity-50" fill="currentColor" viewBox="0 0 20 20">
                            <path d="M2 6a2 2 0 012-2h6a2 2 0 012 2v8a2 2 0 01-2 2H4a2 2 0 01-2-2V6zM14.553 7.106A1 1 0 0014 8v4a1 1 0 00.553.894l2 1A1 1 0 0018 13V7a1 1 0 00-1.447-.894l-2 1z" />
                        </svg>
                        <p>No media yet</p>
                        <p className="text-xs mt-1">Click "Add Media"</p>
                    </div>
                ) : (
                    assetList.map(asset => (
                        <MediaItem
                            key={asset.id}
                            asset={asset}
                            isSelected={selectedAssetId === asset.id}
                            onSelect={setSelectedAssetId}
                            onAddToTimeline={handleAddToTimeline}
                            onDelete={handleDeleteAsset}
                        />
                    ))
                )}
            </div>

            {/* Footer info */}
            <div className="p-2 border-t border-gray-700 text-xs text-gray-500">
                {assetList.length} media
            </div>
        </div>
    );
}
