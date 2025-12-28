/**
 * MediaItem - Single media thumbnail in the Media Panel
 */
import { useState, useEffect } from 'react';
import { Asset } from '../../types/timeline';
import { generateVideoThumbnail, formatDuration } from '../../utils/thumbnailGenerator';

interface MediaItemProps {
    asset: Asset;
    onAddToTimeline: (assetId: string) => void;
    onDelete: (assetId: string) => void;
    isSelected?: boolean;
    onSelect?: (assetId: string) => void;
}

export function MediaItem({
    asset,
    onAddToTimeline,
    onDelete,
    isSelected = false,
    onSelect
}: MediaItemProps) {
    const [thumbnail, setThumbnail] = useState<string | null>(null);

    useEffect(() => {
        if (asset.videoElement && asset.videoElement.readyState >= 2) {
            generateVideoThumbnail(asset.videoElement)
                .then(setThumbnail)
                .catch(console.error);
        }
    }, [asset.videoElement]);

    const handleDoubleClick = () => {
        onAddToTimeline(asset.id);
    };

    const handleClick = () => {
        onSelect?.(asset.id);
    };

    return (
        <div
            className={`relative group rounded-lg overflow-hidden cursor-pointer transition-all ${isSelected ? 'ring-2 ring-blue-500' : 'hover:ring-2 hover:ring-gray-500'
                }`}
            onClick={handleClick}
            onDoubleClick={handleDoubleClick}
            title={`Double-click to add to timeline\n${asset.name}`}
        >
            {/* Thumbnail */}
            <div className="aspect-video bg-gray-800 relative">
                {thumbnail ? (
                    <img
                        src={thumbnail}
                        alt={asset.name}
                        className="w-full h-full object-cover"
                    />
                ) : (
                    <div className="w-full h-full flex items-center justify-center text-gray-500">
                        <svg className="w-8 h-8" fill="currentColor" viewBox="0 0 20 20">
                            <path d="M2 6a2 2 0 012-2h6a2 2 0 012 2v8a2 2 0 01-2 2H4a2 2 0 01-2-2V6zM14.553 7.106A1 1 0 0014 8v4a1 1 0 00.553.894l2 1A1 1 0 0018 13V7a1 1 0 00-1.447-.894l-2 1z" />
                        </svg>
                    </div>
                )}

                {/* Duration badge */}
                <div className="absolute bottom-1 right-1 bg-black/70 text-white text-xs px-1 py-0.5 rounded">
                    {formatDuration(asset.duration)}
                </div>

                {/* Delete button (on hover) */}
                <button
                    onClick={(e) => {
                        e.stopPropagation();
                        onDelete(asset.id);
                    }}
                    className="absolute top-1 right-1 w-6 h-6 bg-red-500/80 hover:bg-red-600 text-white rounded-full opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center"
                    title="Delete media"
                >
                    ✕
                </button>

                {/* Add button (on hover) */}
                <button
                    onClick={(e) => {
                        e.stopPropagation();
                        onAddToTimeline(asset.id);
                    }}
                    className="absolute bottom-1 left-1 px-2 py-1 bg-blue-500/80 hover:bg-blue-600 text-white text-xs rounded opacity-0 group-hover:opacity-100 transition-opacity"
                    title="Add to timeline"
                >
                    + Add
                </button>
            </div>

            {/* Filename */}
            <div className="p-1.5 bg-gray-900">
                <p className="text-xs text-gray-300 truncate" title={asset.name}>
                    {asset.name}
                </p>
            </div>
        </div>
    );
}
