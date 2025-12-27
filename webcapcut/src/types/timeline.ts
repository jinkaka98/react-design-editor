/**
 * Timeline data types for multi-track video editing
 * Using explicit gap segments model (CapCut-style)
 */

// ============================================================================
// SEGMENT TYPES
// ============================================================================

/**
 * A segment represents a time range on the timeline.
 * Can be either a clip (with content) or a gap (empty space).
 */
export type TimelineSegment = ClipSegment | GapSegment;

/**
 * A clip segment contains actual media content
 */
export interface ClipSegment {
    type: 'clip';
    id: string;              // Unique segment ID
    clipId: string;          // Reference to clip data
    start: number;           // Timeline position (microseconds)
    duration: number;        // Segment duration (microseconds)
}

/**
 * A gap segment represents empty space on the timeline
 */
export interface GapSegment {
    type: 'gap';
    id: string;              // Unique segment ID
    start: number;           // Timeline position (microseconds)
    duration: number;        // Gap duration (microseconds)
}

// ============================================================================
// CLIP & ASSET TYPES
// ============================================================================

/**
 * Represents a media asset (video/audio file)
 */
export interface Asset {
    id: string;
    name: string;
    type: 'video' | 'audio' | 'image';
    duration: number;          // Total duration in microseconds
    file: File;
    videoElement?: HTMLVideoElement; // For video playback
    thumbnailUrl?: string;     // Preview thumbnail
}

/**
 * Clip data - references source media with in/out points
 */
export interface ClipData {
    id: string;
    assetId: string;           // Reference to source Asset
    srcStart: number;          // Start time in source media (microseconds)
    srcEnd: number;            // End time in source media (microseconds)
}

// ============================================================================
// TRACK TYPE
// ============================================================================

/**
 * Represents a track on the timeline
 * Uses segments array containing both clips and gaps
 */
export interface Track {
    id: string;
    type: 'video' | 'audio';
    name: string;              // e.g., "V1", "V2", "A1"
    segments: TimelineSegment[];  // Ordered segments (clips and gaps)
    muted: boolean;
    locked: boolean;
    height: number;            // Track height in pixels
}

// ============================================================================
// TIMELINE STATE
// ============================================================================

/**
 * Timeline state and configuration
 */
export interface TimelineState {
    tracks: Track[];
    assets: Map<string, Asset>;
    clips: Map<string, ClipData>;  // Central clip registry
    selectedSegmentId: string | null;
    selectedTrackId: string | null;
    duration: number;          // Total timeline duration
    zoom: number;              // Pixels per second
    scrollX: number;           // Horizontal scroll position (pixels)
    scrollY: number;           // Vertical scroll position (pixels)
}

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

/**
 * Generate unique ID
 */
export function generateId(): string {
    return `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
}

/**
 * Get the end time of a segment
 */
export function getSegmentEnd(segment: TimelineSegment): number {
    return segment.start + segment.duration;
}

/**
 * Get track duration (end of last segment)
 */
export function getTrackDuration(track: Track): number {
    if (track.segments.length === 0) return 0;
    const lastSegment = track.segments[track.segments.length - 1];
    return getSegmentEnd(lastSegment);
}

/**
 * Find segment at a specific time
 */
export function findSegmentAtTime(track: Track, time: number): TimelineSegment | null {
    for (const seg of track.segments) {
        if (time >= seg.start && time < getSegmentEnd(seg)) {
            return seg;
        }
    }
    return null;
}

/**
 * Find the index of segment at a specific time
 */
export function findSegmentIndexAtTime(track: Track, time: number): number {
    for (let i = 0; i < track.segments.length; i++) {
        const seg = track.segments[i];
        if (time >= seg.start && time < getSegmentEnd(seg)) {
            return i;
        }
    }
    return -1;
}

/**
 * Create a gap segment
 */
export function createGap(start: number, duration: number): GapSegment {
    return {
        type: 'gap',
        id: `gap-${generateId()}`,
        start,
        duration,
    };
}

/**
 * Create a clip segment
 */
export function createClipSegment(clipId: string, start: number, duration: number): ClipSegment {
    return {
        type: 'clip',
        id: `seg-${generateId()}`,
        clipId,
        start,
        duration,
    };
}

/**
 * Merge adjacent gaps in a segments array
 * Returns a new array with gaps merged
 * IMPORTANT: Only merges gaps that are actually adjacent in time
 */
export function mergeAdjacentGaps(segments: TimelineSegment[]): TimelineSegment[] {
    if (segments.length <= 1) return [...segments];

    // First, sort by start time to ensure order
    const sorted = [...segments].sort((a, b) => a.start - b.start);
    const result: TimelineSegment[] = [];

    for (const seg of sorted) {
        const last = result[result.length - 1];

        if (last && last.type === 'gap' && seg.type === 'gap') {
            // Check if gaps are actually adjacent (within tolerance)
            const lastEnd = last.start + last.duration;
            if (Math.abs(lastEnd - seg.start) < 1) { // 1 microsecond tolerance
                // Merge: extend previous gap's duration
                last.duration = (seg.start + seg.duration) - last.start;
                continue;
            }
        }

        result.push({ ...seg });
    }

    // Remove zero-duration gaps
    return result.filter(seg => seg.duration > 0);
}

/**
 * Validate segment continuity - for debugging
 * Returns array of errors, empty if valid
 */
export function validateSegments(segments: TimelineSegment[]): string[] {
    const errors: string[] = [];

    for (let i = 0; i < segments.length - 1; i++) {
        const current = segments[i];
        const next = segments[i + 1];
        const currentEnd = current.start + current.duration;

        if (Math.abs(currentEnd - next.start) > 1) { // 1 microsecond tolerance
            errors.push(`Gap in timeline at index ${i}: segment ends at ${currentEnd}, next starts at ${next.start}`);
        }
    }

    return errors;
}

/**
 * Normalize segments - ensure all segments are contiguous from 0
 */
export function normalizeSegments(segments: TimelineSegment[]): TimelineSegment[] {
    if (segments.length === 0) return [];

    const sorted = [...segments].sort((a, b) => a.start - b.start);
    const result: TimelineSegment[] = [];
    let currentTime = 0;

    for (const seg of sorted) {
        // If there's a gap before this segment, add it
        if (seg.start > currentTime) {
            result.push(createGap(currentTime, seg.start - currentTime));
        }

        // Add the segment with normalized start
        result.push({
            ...seg,
            start: result.length > 0 ? getSegmentEnd(result[result.length - 1]) : seg.start,
        });

        currentTime = getSegmentEnd(seg);
    }

    return mergeAdjacentGaps(result);
}

/**
 * Insert a clip segment at a specific time
 * Splits any existing gap to make room
 */
export function insertClipAtTime(
    segments: TimelineSegment[],
    clipId: string,
    timelineStart: number,
    duration: number
): TimelineSegment[] {
    const newSegments: TimelineSegment[] = [];
    const clipEnd = timelineStart + duration;
    let inserted = false;

    // Handle empty track
    if (segments.length === 0) {
        if (timelineStart > 0) {
            newSegments.push(createGap(0, timelineStart));
        }
        newSegments.push(createClipSegment(clipId, timelineStart, duration));
        return newSegments;
    }

    for (const seg of segments) {
        const segEnd = getSegmentEnd(seg);

        if (inserted) {
            // Already inserted, just copy remaining segments
            newSegments.push({ ...seg });
            continue;
        }

        if (seg.type === 'gap') {
            // Check if clip fits in this gap
            if (timelineStart >= seg.start && clipEnd <= segEnd) {
                // Gap before clip
                if (timelineStart > seg.start) {
                    newSegments.push(createGap(seg.start, timelineStart - seg.start));
                }

                // Insert clip
                newSegments.push(createClipSegment(clipId, timelineStart, duration));
                inserted = true;

                // Gap after clip
                if (clipEnd < segEnd) {
                    newSegments.push(createGap(clipEnd, segEnd - clipEnd));
                }
            } else {
                newSegments.push({ ...seg });
            }
        } else {
            newSegments.push({ ...seg });
        }
    }

    // If not inserted (clip goes after all segments)
    if (!inserted) {
        const lastEnd = getTrackDuration({ segments: newSegments } as Track);
        if (timelineStart > lastEnd) {
            newSegments.push(createGap(lastEnd, timelineStart - lastEnd));
        }
        newSegments.push(createClipSegment(clipId, timelineStart, duration));
    }

    return mergeAdjacentGaps(newSegments);
}

/**
 * Remove a clip segment and replace with gap
 */
export function removeClipSegment(
    segments: TimelineSegment[],
    segmentId: string
): TimelineSegment[] {
    const newSegments = segments.map(seg => {
        if (seg.type === 'clip' && seg.id === segmentId) {
            return createGap(seg.start, seg.duration);
        }
        return { ...seg };
    });

    return mergeAdjacentGaps(newSegments);
}

/**
 * Ripple delete - remove clip and shift all following segments left
 */
export function rippleDeleteClipSegment(
    segments: TimelineSegment[],
    segmentId: string
): TimelineSegment[] {
    const segmentToDelete = segments.find(s => s.id === segmentId);
    if (!segmentToDelete || segmentToDelete.type !== 'clip') {
        return segments;
    }

    const deleteStart = segmentToDelete.start;
    const shiftAmount = segmentToDelete.duration;

    const newSegments: TimelineSegment[] = segments
        .filter(s => s.id !== segmentId)
        .map(seg => {
            if (seg.start > deleteStart) {
                return { ...seg, start: seg.start - shiftAmount };
            }
            return { ...seg };
        });

    return mergeAdjacentGaps(newSegments);
}

/**
 * Move a clip segment to a new position
 */
export function moveClipSegment(
    segments: TimelineSegment[],
    segmentId: string,
    newStart: number
): TimelineSegment[] {
    const segIndex = segments.findIndex(s => s.id === segmentId);
    if (segIndex === -1) return segments;

    const seg = segments[segIndex];
    if (seg.type !== 'clip') return segments;

    const clipId = seg.clipId;
    const clipDuration = seg.duration;

    // Step 1: Replace the clip with a gap at its old position
    const segmentsWithGap: TimelineSegment[] = segments.map((s, i) => {
        if (i === segIndex) {
            return createGap(s.start, s.duration);
        }
        return { ...s };
    });

    // Step 2: Merge adjacent gaps (this handles the old position)
    const mergedGaps = mergeAdjacentGaps(segmentsWithGap);

    // Step 3: Insert clip at new position
    const result = insertClipAtTime(mergedGaps, clipId, newStart, clipDuration);

    // Step 4: Rebuild to ensure continuity (no stray gaps at end)
    return rebuildSegments(result);
}

/**
 * Rebuild segments to ensure proper continuity
 * Removes gaps at the end, ensures no overlaps
 */
export function rebuildSegments(segments: TimelineSegment[]): TimelineSegment[] {
    if (segments.length === 0) return [];

    // Sort by start time
    const sorted = [...segments].sort((a, b) => a.start - b.start);

    // Rebuild with proper positions
    const result: TimelineSegment[] = [];
    let currentTime = 0;

    for (const seg of sorted) {
        // Skip zero or negative duration
        if (seg.duration <= 0) continue;

        // If there's a gap between current time and segment start, we have a problem
        // But for clips, we want to preserve their intended position
        if (seg.type === 'clip') {
            // If clip starts after current time, add gap
            if (seg.start > currentTime) {
                result.push(createGap(currentTime, seg.start - currentTime));
            }
            result.push({ ...seg });
            currentTime = seg.start + seg.duration;
        } else {
            // For gaps, respect their start position
            if (seg.start >= currentTime) {
                // Adjust gap to start at current time if needed
                const gapStart = Math.max(seg.start, currentTime);
                const gapEnd = seg.start + seg.duration;
                if (gapEnd > gapStart) {
                    result.push(createGap(gapStart, gapEnd - gapStart));
                    currentTime = gapEnd;
                }
            }
        }
    }

    // Remove trailing gaps (gaps at the end with no clips after)
    while (result.length > 0 && result[result.length - 1].type === 'gap') {
        const lastSegment = result[result.length - 1];
        // Check if there's any clip after this gap
        const hasClipAfter = result.slice(result.indexOf(lastSegment) + 1)
            .some(s => s.type === 'clip');
        if (!hasClipAfter) {
            result.pop();
        } else {
            break;
        }
    }

    return mergeAdjacentGaps(result);
}

/**
 * Get clip duration from ClipData
 */
export function getClipDuration(clip: ClipData): number {
    return clip.srcEnd - clip.srcStart;
}
