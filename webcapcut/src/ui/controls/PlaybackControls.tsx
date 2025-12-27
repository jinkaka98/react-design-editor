import { usePlaybackStore } from '../../store/playbackStore';
import { TimeDisplay } from '../components/TimeDisplay';
import { SpeedSelector } from './SpeedSelector';

export function PlaybackControls() {
    const { isPlaying, currentTime, duration, togglePlayPause } = usePlaybackStore();

    return (
        <div className="flex items-center gap-4 px-4 py-2 bg-gray-900 text-white">
            {/* Play/Pause Button */}
            <button
                onClick={togglePlayPause}
                className="p-2 rounded hover:bg-gray-700 transition-colors"
                title={isPlaying ? 'Pause (Space)' : 'Play (Space)'}
            >
                {isPlaying ? (
                    <svg className="w-6 h-6" fill="currentColor" viewBox="0 0 20 20">
                        <path d="M5 4h3v12H5V4zm7 0h3v12h-3V4z" />
                    </svg>
                ) : (
                    <svg className="w-6 h-6" fill="currentColor" viewBox="0 0 20 20">
                        <path d="M6 4l10 6-10 6V4z" />
                    </svg>
                )}
            </button>

            {/* Time Display */}
            <div className="flex items-center gap-2">
                <TimeDisplay time={currentTime} className="text-white" />
                <span className="text-gray-500">/</span>
                <TimeDisplay time={duration} className="text-gray-400" />
            </div>

            {/* Spacer */}
            <div className="flex-1" />

            {/* Speed Selector */}
            <SpeedSelector />
        </div>
    );
}
