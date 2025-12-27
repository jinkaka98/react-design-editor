import { usePlaybackStore } from '../../store/playbackStore';

const SPEED_OPTIONS = [0.25, 0.5, 0.75, 1, 1.25, 1.5, 1.75, 2];

export function SpeedSelector() {
    const playbackRate = usePlaybackStore(state => state.playbackRate);
    const setPlaybackRate = usePlaybackStore(state => state.setPlaybackRate);

    return (
        <div className="flex items-center gap-2">
            <label className="text-gray-400 text-sm">Speed:</label>
            <select
                value={playbackRate}
                onChange={(e) => setPlaybackRate(Number(e.target.value))}
                className="bg-gray-700 text-white text-sm px-2 py-1 rounded border border-gray-600 focus:outline-none focus:border-blue-500"
            >
                {SPEED_OPTIONS.map(speed => (
                    <option key={speed} value={speed}>
                        {speed}x
                    </option>
                ))}
            </select>
        </div>
    );
}
