/**
 * Video validation utilities
 */

export interface VideoValidationResult {
    valid: boolean;
    error?: string;
    warnings?: string[];
}

// Supported video formats
const SUPPORTED_FORMATS = [
    'video/mp4',
    'video/webm',
    'video/quicktime', // .mov
    'video/x-msvideo',  // .avi
];

// Max file size: 500MB
const MAX_FILE_SIZE = 500 * 1024 * 1024;

// Max duration: 30 minutes
const MAX_DURATION = 30 * 60; // seconds

// Min duration: 0.1 seconds
const MIN_DURATION = 0.1;

/**
 * Validate video file before loading
 */
export function validateVideoFile(file: File): VideoValidationResult {
    const warnings: string[] = [];

    // Check file type
    if (!file.type) {
        // Try to infer from extension
        const ext = file.name.split('.').pop()?.toLowerCase();
        if (!ext || !['mp4', 'webm', 'mov', 'avi'].includes(ext)) {
            return { valid: false, error: 'Unknown file format. Please use MP4, WebM, or MOV.' };
        }
        warnings.push('File type not detected, assuming valid based on extension.');
    } else if (!SUPPORTED_FORMATS.includes(file.type)) {
        return { valid: false, error: `Unsupported format: ${file.type}. Please use MP4, WebM, or MOV.` };
    }

    // Check file size
    if (file.size === 0) {
        return { valid: false, error: 'File is empty.' };
    }

    if (file.size > MAX_FILE_SIZE) {
        const sizeMB = (file.size / (1024 * 1024)).toFixed(1);
        return { valid: false, error: `File too large: ${sizeMB}MB. Maximum is 500MB.` };
    }

    // Check file name
    if (!file.name || file.name.trim() === '') {
        return { valid: false, error: 'File has no name.' };
    }

    // Warning for large files
    if (file.size > 100 * 1024 * 1024) {
        const sizeMB = (file.size / (1024 * 1024)).toFixed(1);
        warnings.push(`Large file (${sizeMB}MB) may take time to load.`);
    }

    return { valid: true, warnings: warnings.length > 0 ? warnings : undefined };
}

/**
 * Validate video element after loading
 */
export function validateVideoElement(video: HTMLVideoElement): VideoValidationResult {
    const warnings: string[] = [];

    // Check if video has valid dimensions
    if (video.videoWidth === 0 || video.videoHeight === 0) {
        return { valid: false, error: 'Video has no valid dimensions. File may be corrupted.' };
    }

    // Check duration
    if (isNaN(video.duration) || !isFinite(video.duration)) {
        return { valid: false, error: 'Unable to determine video duration.' };
    }

    if (video.duration < MIN_DURATION) {
        return { valid: false, error: 'Video is too short (minimum 0.1 seconds).' };
    }

    if (video.duration > MAX_DURATION) {
        const mins = Math.floor(video.duration / 60);
        return { valid: false, error: `Video too long: ${mins} minutes. Maximum is 30 minutes.` };
    }

    // Check ready state
    if (video.readyState < 3) {
        return { valid: false, error: 'Video not fully loaded. Please wait.' };
    }

    // Check for errors
    if (video.error) {
        return { valid: false, error: `Video error: ${video.error.message || 'Unknown error'}` };
    }

    // Warnings for unusual dimensions
    if (video.videoWidth > 4096 || video.videoHeight > 4096) {
        warnings.push('Very high resolution video may impact performance.');
    }

    if (video.videoWidth < 100 || video.videoHeight < 100) {
        warnings.push('Very low resolution video detected.');
    }

    // Check aspect ratio
    const aspectRatio = video.videoWidth / video.videoHeight;
    if (aspectRatio > 4 || aspectRatio < 0.25) {
        warnings.push('Unusual aspect ratio detected.');
    }

    return { valid: true, warnings: warnings.length > 0 ? warnings : undefined };
}

/**
 * Check if asset already exists in store
 */
export function isDuplicateFile(fileName: string, existingAssets: Map<string, { name: string }>): boolean {
    for (const asset of existingAssets.values()) {
        if (asset.name === fileName) {
            return true;
        }
    }
    return false;
}

/**
 * Generate unique asset name if duplicate
 */
export function generateUniqueAssetName(baseName: string, existingAssets: Map<string, { name: string }>): string {
    if (!isDuplicateFile(baseName, existingAssets)) {
        return baseName;
    }

    const ext = baseName.includes('.') ? '.' + baseName.split('.').pop() : '';
    const nameWithoutExt = baseName.includes('.')
        ? baseName.slice(0, baseName.lastIndexOf('.'))
        : baseName;

    let counter = 2;
    let newName = `${nameWithoutExt} (${counter})${ext}`;

    while (isDuplicateFile(newName, existingAssets)) {
        counter++;
        newName = `${nameWithoutExt} (${counter})${ext}`;
    }

    return newName;
}

/**
 * Format file size for display
 */
export function formatFileSize(bytes: number): string {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    if (bytes < 1024 * 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
    return `${(bytes / (1024 * 1024 * 1024)).toFixed(1)} GB`;
}

/**
 * Format duration for display
 */
export function formatDuration(microseconds: number): string {
    const seconds = microseconds / 1_000_000;
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    const ms = Math.floor((seconds % 1) * 10);

    if (mins > 0) {
        return `${mins}:${secs.toString().padStart(2, '0')}.${ms}`;
    }
    return `${secs}.${ms}s`;
}
