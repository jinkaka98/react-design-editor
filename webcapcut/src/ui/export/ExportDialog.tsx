import { useState, useMemo } from 'react';
import { ExportPreset, EXPORT_PRESETS } from '../../types/video';
import { exportManager, ExportProgress } from '../../core/ExportManager';
import { useProjectStore } from '../../store/projectStore';

interface ExportDialogProps {
    isOpen: boolean;
    onClose: () => void;
}

export function ExportDialog({ isOpen, onClose }: ExportDialogProps) {
    const projectSettings = useProjectStore(state => state.settings);

    // Create "Match Project" preset dynamically
    const allPresets = useMemo(() => {
        const matchProject: ExportPreset = {
            name: 'match-project',
            label: `Match Project (${projectSettings.width}×${projectSettings.height})`,
            options: {
                width: projectSettings.width,
                height: projectSettings.height,
                frameRate: 30,
                videoBitrate: 10_000_000,
                audioBitrate: 192_000,
                audioSampleRate: 48000
            }
        };
        return [matchProject, ...EXPORT_PRESETS];
    }, [projectSettings.width, projectSettings.height]);

    const [selectedPreset, setSelectedPreset] = useState<ExportPreset>(allPresets[0]); // Default Match Project
    const [progress, setProgress] = useState<ExportProgress | null>(null);
    const [isExporting, setIsExporting] = useState(false);
    const [downloadUrl, setDownloadUrl] = useState<string | null>(null);

    if (!isOpen) return null;

    const handleExport = async () => {
        setIsExporting(true);
        setProgress(null);
        setDownloadUrl(null);

        // Pause playback during export to free resources
        const { usePlaybackStore } = await import('../../store/playbackStore');
        const wasPlaying = usePlaybackStore.getState().isPlaying;
        if (wasPlaying) {
            usePlaybackStore.getState().pause();
        }

        try {
            const blob = await exportManager.export(selectedPreset.options, (p) => {
                setProgress(p);
            });

            // Create download URL
            const url = URL.createObjectURL(blob);
            setDownloadUrl(url);
            setIsExporting(false);
        } catch (error) {
            console.error('[ExportDialog] Export failed:', error);
            setProgress({
                percent: 0,
                currentFrame: 0,
                totalFrames: 0,
                stage: 'error',
                error: error instanceof Error ? error.message : 'Unknown error'
            });
            setIsExporting(false);
        }
    };

    const handleCancel = () => {
        if (isExporting) {
            exportManager.cancel();
            setIsExporting(false);
        }
    };

    const handleDownload = () => {
        if (!downloadUrl) return;

        const a = document.createElement('a');
        a.href = downloadUrl;
        a.download = `export_${Date.now()}.mp4`;
        a.click();
    };

    const handleClose = () => {
        if (downloadUrl) {
            URL.revokeObjectURL(downloadUrl);
        }
        setDownloadUrl(null);
        setProgress(null);
        onClose();
    };

    return (
        <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50">
            <div className="bg-gray-800 rounded-lg shadow-xl w-[480px] max-w-[90vw]">
                {/* Header */}
                <div className="flex items-center justify-between px-6 py-4 border-b border-gray-700">
                    <h2 className="text-xl font-semibold text-white">Export Video</h2>
                    <button
                        onClick={handleClose}
                        className="text-gray-400 hover:text-white text-2xl leading-none"
                        disabled={isExporting}
                    >
                        ×
                    </button>
                </div>

                {/* Content */}
                <div className="px-6 py-4 space-y-4">
                    {/* Preset Selection */}
                    <div>
                        <label className="block text-sm text-gray-400 mb-2">Resolution Preset</label>
                        <select
                            value={selectedPreset.name}
                            onChange={(e) => {
                                const preset = allPresets.find(p => p.name === e.target.value);
                                if (preset) setSelectedPreset(preset);
                            }}
                            disabled={isExporting}
                            className="w-full bg-gray-700 text-white rounded px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
                        >
                            {allPresets.map(preset => (
                                <option key={preset.name} value={preset.name}>
                                    {preset.label}
                                </option>
                            ))}
                        </select>
                    </div>

                    {/* Settings Display */}
                    <div className="bg-gray-700/50 rounded p-3 text-sm text-gray-300 space-y-1">
                        <div className="flex justify-between">
                            <span>Size:</span>
                            <span>{selectedPreset.options.width} × {selectedPreset.options.height}</span>
                        </div>
                        <div className="flex justify-between">
                            <span>Frame Rate:</span>
                            <span>{selectedPreset.options.frameRate} fps</span>
                        </div>
                        <div className="flex justify-between">
                            <span>Video Bitrate:</span>
                            <span>{(selectedPreset.options.videoBitrate / 1_000_000).toFixed(1)} Mbps</span>
                        </div>
                        <div className="flex justify-between">
                            <span>Audio Bitrate:</span>
                            <span>{(selectedPreset.options.audioBitrate / 1000).toFixed(0)} kbps</span>
                        </div>
                    </div>

                    {/* Progress Bar */}
                    {progress && (
                        <div className="space-y-2">
                            <div className="flex justify-between text-sm">
                                <span className="text-gray-400">
                                    {progress.stage === 'preparing' && 'Preparing...'}
                                    {progress.stage === 'encoding' && `Encoding frame ${progress.currentFrame}/${progress.totalFrames}`}
                                    {progress.stage === 'muxing' && 'Creating MP4...'}
                                    {progress.stage === 'complete' && '✓ Export complete!'}
                                    {progress.stage === 'error' && `❌ Error: ${progress.error}`}
                                </span>
                                <span className="text-white font-medium">{progress.percent}%</span>
                            </div>
                            <div className="h-2 bg-gray-700 rounded-full overflow-hidden">
                                <div
                                    className={`h-full transition-all duration-200 ${progress.stage === 'error' ? 'bg-red-500' :
                                        progress.stage === 'complete' ? 'bg-green-500' : 'bg-blue-500'
                                        }`}
                                    style={{ width: `${progress.percent}%` }}
                                />
                            </div>
                        </div>
                    )}

                    {/* Download Button */}
                    {downloadUrl && (
                        <button
                            onClick={handleDownload}
                            className="w-full bg-green-600 hover:bg-green-700 text-white font-medium py-3 rounded-lg transition-colors flex items-center justify-center gap-2"
                        >
                            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                            </svg>
                            Download MP4
                        </button>
                    )}
                </div>

                {/* Footer Actions */}
                <div className="px-6 py-4 border-t border-gray-700 flex gap-3">
                    <button
                        onClick={handleClose}
                        className="flex-1 bg-gray-600 hover:bg-gray-500 text-white py-2 rounded-lg transition-colors"
                        disabled={isExporting}
                    >
                        {downloadUrl ? 'Close' : 'Cancel'}
                    </button>
                    {!downloadUrl && (
                        <button
                            onClick={isExporting ? handleCancel : handleExport}
                            className={`flex-1 py-2 rounded-lg transition-colors font-medium ${isExporting
                                ? 'bg-red-600 hover:bg-red-700 text-white'
                                : 'bg-blue-600 hover:bg-blue-700 text-white'
                                }`}
                        >
                            {isExporting ? 'Cancel Export' : 'Start Export'}
                        </button>
                    )}
                </div>
            </div>
        </div>
    );
}
