/**
 * FrameBoundary - Always visible frame boundary showing preset limits
 * Shows the exact area where video will be rendered/exported
 */

interface FrameBoundaryProps {
    displayWidth: number;
    displayHeight: number;
}

export function FrameBoundary({
    displayWidth,
    displayHeight
}: FrameBoundaryProps) {
    return (
        <div
            className="absolute inset-0 pointer-events-none"
            style={{
                width: displayWidth,
                height: displayHeight,
                zIndex: 10  // Above TransformPreview (z-index: 5)
            }}
        >
            {/* Main frame boundary - ALWAYS visible */}
            <div
                className="absolute inset-0"
                style={{
                    border: '2px solid #ef4444', // Red border for frame limit
                    boxSizing: 'border-box',
                }}
            />

            {/* Corner brackets - White L-shapes */}
            {/* Top-left */}
            <div style={{ position: 'absolute', left: 0, top: 0, width: 20, height: 2, backgroundColor: 'white' }} />
            <div style={{ position: 'absolute', left: 0, top: 0, width: 2, height: 20, backgroundColor: 'white' }} />

            {/* Top-right */}
            <div style={{ position: 'absolute', right: 0, top: 0, width: 20, height: 2, backgroundColor: 'white' }} />
            <div style={{ position: 'absolute', right: 0, top: 0, width: 2, height: 20, backgroundColor: 'white' }} />

            {/* Bottom-left */}
            <div style={{ position: 'absolute', left: 0, bottom: 0, width: 20, height: 2, backgroundColor: 'white' }} />
            <div style={{ position: 'absolute', left: 0, bottom: 0, width: 2, height: 20, backgroundColor: 'white' }} />

            {/* Bottom-right */}
            <div style={{ position: 'absolute', right: 0, bottom: 0, width: 20, height: 2, backgroundColor: 'white' }} />
            <div style={{ position: 'absolute', right: 0, bottom: 0, width: 2, height: 20, backgroundColor: 'white' }} />

            {/* Frame label */}
            <div
                className="absolute text-xs font-medium px-1.5 py-0.5 rounded"
                style={{
                    top: -22,
                    left: '50%',
                    transform: 'translateX(-50%)',
                    backgroundColor: 'rgba(239, 68, 68, 0.9)',
                    color: 'white',
                    fontSize: '10px',
                    whiteSpace: 'nowrap'
                }}
            >
                FRAME BOUNDARY
            </div>
        </div>
    );
}
