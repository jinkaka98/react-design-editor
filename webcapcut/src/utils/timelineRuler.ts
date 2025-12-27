/**
 * Timeline Ruler Utilities
 * Generates adaptive time labels based on zoom level
 */

export type TimeUnit = 'frames' | 'seconds' | 'minutes' | 'hours';

export interface Tick {
    position: number;      // Pixel position
    time: number;         // Time in microseconds
    label?: string;       // Display string
    type: 'major' | 'minor';
}

// Frame rate (can be made dynamic later)
export const FPS = 30;

// Minimal spacing to prevent overlapping labels
const MIN_LABEL_SPACING_PX = 60;
const MIN_MINOR_TICK_SPACING_PX = 8;

/**
 * Determine appropriate time unit based on zoom level
 */
export function getTimeUnit(pixelsPerSecond: number): TimeUnit {
    if (pixelsPerSecond >= 150) return 'frames';
    if (pixelsPerSecond >= 20) return 'seconds';
    if (pixelsPerSecond >= 0.5) return 'minutes';
    return 'hours';
}

/**
 * Get nice interval values for given unit
 */
function getIntervals(unit: TimeUnit): { major: number; minor: number } {
    switch (unit) {
        case 'frames':
            return { major: 1_000_000, minor: 1_000_000 / FPS }; // 1s major, 1 frame minor
        case 'seconds':
            return { major: 1_000_000, minor: 250_000 }; // 1s major, 0.25s minor
        case 'minutes':
            return { major: 60_000_000, minor: 10_000_000 }; // 1min major, 10s minor
        case 'hours':
            return { major: 3600_000_000, minor: 300_000_000 }; // 1hr major, 5min minor
    }
}

/**
 * Format time as human-readable label
 */
export function formatTimeLabel(timeMicros: number, unit: TimeUnit): string {
    const seconds = timeMicros / 1_000_000;

    switch (unit) {
        case 'frames': {
            const sec = Math.floor(seconds);
            const frames = Math.round((seconds - sec) * FPS);
            return frames === 0 ? `${sec}s` : `${sec}s${frames}f`;
        }
        case 'seconds': {
            return `${Math.floor(seconds)}s`;
        }
        case 'minutes': {
            const mins = Math.floor(seconds / 60);
            const secs = Math.floor(seconds % 60);
            return `${mins}:${secs.toString().padStart(2, '0')}`;
        }
        case 'hours': {
            const hours = Math.floor(seconds / 3600);
            const mins = Math.floor((seconds % 3600) / 60);
            return `${hours}h${mins.toString().padStart(2, '0')}m`;
        }
    }
}

/**
 * Generate timeline ticks for ruler display
 */
export function generateTimelineTicks(
    durationMicros: number,
    pixelsPerSecond: number,
    scrollOffsetPx: number,
    viewportWidthPx: number
): Tick[] {
    const unit = getTimeUnit(pixelsPerSecond);
    let { major: majorInterval, minor: minorInterval } = getIntervals(unit);

    // Pixels per microsecond
    const pxPerMicro = pixelsPerSecond / 1_000_000;

    // Adjust major interval if labels would overlap
    while (majorInterval * pxPerMicro < MIN_LABEL_SPACING_PX) {
        // Step up to next nice interval
        if (majorInterval <= 1_000_000) majorInterval = 5_000_000;       // 5s
        else if (majorInterval <= 5_000_000) majorInterval = 10_000_000;  // 10s
        else if (majorInterval <= 10_000_000) majorInterval = 15_000_000; // 15s
        else if (majorInterval <= 15_000_000) majorInterval = 30_000_000; // 30s
        else if (majorInterval <= 30_000_000) majorInterval = 60_000_000; // 1min
        else if (majorInterval <= 60_000_000) majorInterval = 300_000_000; // 5min
        else if (majorInterval <= 300_000_000) majorInterval = 600_000_000; // 10min
        else if (majorInterval <= 600_000_000) majorInterval = 1800_000_000; // 30min
        else if (majorInterval <= 1800_000_000) majorInterval = 3600_000_000; // 1hr
        else break;
    }

    // Adjust minor interval if ticks would be too close
    while (minorInterval * pxPerMicro < MIN_MINOR_TICK_SPACING_PX) {
        minorInterval *= 2;
    }

    // Calculate visible time range
    const startTimeMicros = (scrollOffsetPx / pixelsPerSecond) * 1_000_000;
    const endTimeMicros = ((scrollOffsetPx + viewportWidthPx) / pixelsPerSecond) * 1_000_000;

    // Start from aligned position
    const alignedStart = Math.floor(startTimeMicros / minorInterval) * minorInterval;

    const ticks: Tick[] = [];

    for (let t = alignedStart; t <= Math.min(endTimeMicros, durationMicros); t += minorInterval) {
        if (t < 0) continue;

        const isMajor = Math.abs(t % majorInterval) < minorInterval / 2;
        const position = (t / 1_000_000) * pixelsPerSecond - scrollOffsetPx;

        // Skip if outside viewport (with small buffer)
        if (position < -50 || position > viewportWidthPx + 50) continue;

        if (isMajor) {
            ticks.push({
                position,
                time: t,
                label: formatTimeLabel(t, unit),
                type: 'major',
            });
        } else {
            ticks.push({
                position,
                time: t,
                type: 'minor',
            });
        }
    }

    return ticks;
}
