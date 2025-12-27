/**
 * Format microseconds to HH:MM:SS or MM:SS
 */
export function formatTime(microseconds: number): string {
    const totalSeconds = Math.floor(microseconds / 1_000_000);
    const hours = Math.floor(totalSeconds / 3600);
    const minutes = Math.floor((totalSeconds % 3600) / 60);
    const seconds = totalSeconds % 60;

    if (hours > 0) {
        return `${hours}:${pad(minutes)}:${pad(seconds)}`;
    }
    return `${minutes}:${pad(seconds)}`;
}

function pad(num: number): string {
    return num.toString().padStart(2, '0');
}
