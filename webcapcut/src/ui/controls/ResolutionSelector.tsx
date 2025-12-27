import { useProjectStore, ASPECT_RATIO_PRESETS, type AspectRatioKey } from '../../store/projectStore';

interface ResolutionSelectorProps {
    className?: string;
}

export function ResolutionSelector({ className = '' }: ResolutionSelectorProps) {
    const settings = useProjectStore(state => state.settings);
    const setResolution = useProjectStore(state => state.setResolution);

    const handlePresetClick = (key: AspectRatioKey) => {
        const preset = ASPECT_RATIO_PRESETS[key];
        setResolution(key, preset.width, preset.height);
    };

    return (
        <div className={`flex items-center gap-2 ${className}`}>
            <span className="text-xs text-gray-400">Frame:</span>

            {/* Preset buttons */}
            <div className="flex gap-1">
                {(Object.keys(ASPECT_RATIO_PRESETS) as AspectRatioKey[]).map(key => {
                    const preset = ASPECT_RATIO_PRESETS[key];
                    const isActive = settings.aspectRatio === key;

                    return (
                        <button
                            key={key}
                            className={`px-2 py-1 text-xs rounded-md transition-colors
                                ${isActive
                                    ? 'bg-blue-600 text-white'
                                    : 'bg-gray-700 text-gray-300 hover:bg-gray-600'
                                }`}
                            onClick={() => handlePresetClick(key)}
                            title={`${preset.label}\n${preset.width}×${preset.height}`}
                        >
                            {/* Icon representing aspect ratio */}
                            <span className="inline-flex items-center gap-1">
                                <AspectRatioIcon ratio={key} />
                                <span className="hidden sm:inline">{key}</span>
                            </span>
                        </button>
                    );
                })}
            </div>

            {/* Current resolution display */}
            <span className="text-xs text-gray-500 ml-2">
                {settings.width}×{settings.height}
            </span>
        </div>
    );
}

/** Visual icon representing aspect ratio */
function AspectRatioIcon({ ratio }: { ratio: AspectRatioKey }) {
    // Calculate relative dimensions for icon
    const presets: Record<AspectRatioKey, { w: number; h: number }> = {
        '16:9': { w: 16, h: 9 },
        '9:16': { w: 9, h: 16 },
        '1:1': { w: 12, h: 12 },
        '4:5': { w: 10, h: 12.5 },
        '4:3': { w: 12, h: 9 },
    };

    const size = presets[ratio];
    const scale = 12 / Math.max(size.w, size.h);
    const width = size.w * scale;
    const height = size.h * scale;

    return (
        <svg
            viewBox="0 0 14 14"
            width="14"
            height="14"
            className="inline-block"
        >
            <rect
                x={(14 - width) / 2}
                y={(14 - height) / 2}
                width={width}
                height={height}
                fill="currentColor"
                opacity="0.8"
                rx="1"
            />
        </svg>
    );
}

/** Compact version for toolbar */
export function ResolutionDropdown() {
    const settings = useProjectStore(state => state.settings);
    const setResolution = useProjectStore(state => state.setResolution);

    const handleChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
        const key = e.target.value as AspectRatioKey;
        if (key in ASPECT_RATIO_PRESETS) {
            const preset = ASPECT_RATIO_PRESETS[key];
            setResolution(key, preset.width, preset.height);
        }
    };

    return (
        <select
            value={settings.aspectRatio}
            onChange={handleChange}
            className="bg-gray-700 text-white text-xs rounded px-2 py-1 border border-gray-600 focus:outline-none focus:border-blue-500"
        >
            {(Object.keys(ASPECT_RATIO_PRESETS) as AspectRatioKey[]).map(key => {
                const preset = ASPECT_RATIO_PRESETS[key];
                return (
                    <option key={key} value={key}>
                        {key} - {preset.label}
                    </option>
                );
            })}
        </select>
    );
}
