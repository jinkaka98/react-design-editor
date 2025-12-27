import { formatTime } from '../../utils/timeFormat';

interface TimeDisplayProps {
    time: number; // microseconds
    className?: string;
}

export function TimeDisplay({ time, className = '' }: TimeDisplayProps) {
    return (
        <span className={`font-mono text-sm ${className}`}>
            {formatTime(time)}
        </span>
    );
}
