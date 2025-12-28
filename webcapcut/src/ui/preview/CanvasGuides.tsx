/**
 * CanvasGuides - Visual guide lines for transform adjustments
 * Shows canvas boundaries, center crosshairs, and rule of thirds
 */
import { useTimelineStore } from '../../store/timelineStore';

interface CanvasGuidesProps {
    displayWidth: number;
    displayHeight: number;
}

export function CanvasGuides({
    displayWidth,
    displayHeight
}: CanvasGuidesProps) {
    const selectedClipId = useTimelineStore(state => state.selectedClipId);

    // Only show guides when a clip is selected
    if (!selectedClipId) {
        return null;
    }

    const lineColor = 'rgba(255, 255, 255, 0.25)';
    const centerLineColor = 'rgba(59, 130, 246, 0.4)'; // blue

    return (
        <div
            className="absolute inset-0 pointer-events-none"
            style={{
                width: displayWidth,
                height: displayHeight,
                zIndex: 4
            }}
        >
            {/* MAIN CANVAS BOUNDARY - Very visible */}
            <div
                className="absolute inset-0"
                style={{
                    border: '3px solid #ef4444', // Red solid border for frame limit
                    boxSizing: 'border-box',
                    boxShadow: 'inset 0 0 0 1px rgba(0,0,0,0.5)' // Inner shadow for depth
                }}
            />

            {/* Frame labels at corners */}
            <div
                className="absolute text-xs font-bold px-1 rounded"
                style={{
                    top: 4,
                    left: 4,
                    backgroundColor: 'rgba(239, 68, 68, 0.9)',
                    color: 'white',
                    fontSize: '10px'
                }}
            >
                FRAME LIMIT
            </div>

            {/* Center vertical line */}
            <div
                style={{
                    position: 'absolute',
                    left: '50%',
                    top: 0,
                    width: 1,
                    height: '100%',
                    backgroundColor: centerLineColor,
                    transform: 'translateX(-50%)'
                }}
            />

            {/* Center horizontal line */}
            <div
                style={{
                    position: 'absolute',
                    left: 0,
                    top: '50%',
                    width: '100%',
                    height: 1,
                    backgroundColor: centerLineColor,
                    transform: 'translateY(-50%)'
                }}
            />

            {/* Center point indicator */}
            <div
                style={{
                    position: 'absolute',
                    left: '50%',
                    top: '50%',
                    width: 8,
                    height: 8,
                    borderRadius: '50%',
                    backgroundColor: 'rgba(59, 130, 246, 0.8)',
                    border: '1px solid white',
                    transform: 'translate(-50%, -50%)'
                }}
            />

            {/* Rule of thirds - vertical lines */}
            <div
                style={{
                    position: 'absolute',
                    left: '33.33%',
                    top: 0,
                    width: 1,
                    height: '100%',
                    backgroundColor: lineColor
                }}
            />
            <div
                style={{
                    position: 'absolute',
                    left: '66.66%',
                    top: 0,
                    width: 1,
                    height: '100%',
                    backgroundColor: lineColor
                }}
            />

            {/* Rule of thirds - horizontal lines */}
            <div
                style={{
                    position: 'absolute',
                    left: 0,
                    top: '33.33%',
                    width: '100%',
                    height: 1,
                    backgroundColor: lineColor
                }}
            />
            <div
                style={{
                    position: 'absolute',
                    left: 0,
                    top: '66.66%',
                    width: '100%',
                    height: 1,
                    backgroundColor: lineColor
                }}
            />

            {/* Corner markers - White L-shapes */}
            {/* Top-left */}
            <div style={{ position: 'absolute', left: 0, top: 0, width: 25, height: 3, backgroundColor: 'white' }} />
            <div style={{ position: 'absolute', left: 0, top: 0, width: 3, height: 25, backgroundColor: 'white' }} />

            {/* Top-right */}
            <div style={{ position: 'absolute', right: 0, top: 0, width: 25, height: 3, backgroundColor: 'white' }} />
            <div style={{ position: 'absolute', right: 0, top: 0, width: 3, height: 25, backgroundColor: 'white' }} />

            {/* Bottom-left */}
            <div style={{ position: 'absolute', left: 0, bottom: 0, width: 25, height: 3, backgroundColor: 'white' }} />
            <div style={{ position: 'absolute', left: 0, bottom: 0, width: 3, height: 25, backgroundColor: 'white' }} />

            {/* Bottom-right */}
            <div style={{ position: 'absolute', right: 0, bottom: 0, width: 25, height: 3, backgroundColor: 'white' }} />
            <div style={{ position: 'absolute', right: 0, bottom: 0, width: 3, height: 25, backgroundColor: 'white' }} />

            {/* Safe zone indicator (90%) - Yellow dashed */}
            <div
                className="absolute"
                style={{
                    left: '5%',
                    top: '5%',
                    right: '5%',
                    bottom: '5%',
                    border: '1px dashed rgba(255, 200, 0, 0.5)',
                    borderRadius: 2
                }}
            />
            <div
                className="absolute text-xs px-1 rounded"
                style={{
                    top: '5%',
                    left: '50%',
                    transform: 'translate(-50%, -50%)',
                    backgroundColor: 'rgba(255, 200, 0, 0.7)',
                    color: 'black',
                    fontSize: '9px'
                }}
            >
                SAFE ZONE 90%
            </div>

            {/* Warning text at bottom */}
            <div
                className="absolute text-xs text-center w-full"
                style={{
                    bottom: -20,
                    color: 'rgba(255, 255, 255, 0.6)',
                    fontSize: '10px'
                }}
            >
                Konten di luar garis merah akan terpotong
            </div>
        </div>
    );
}
