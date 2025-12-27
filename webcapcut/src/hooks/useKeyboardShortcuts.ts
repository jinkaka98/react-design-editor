import { useEffect } from 'react';
import { usePlaybackStore } from '../store/playbackStore';

export function useKeyboardShortcuts() {
    const { togglePlayPause, seek, currentTime } = usePlaybackStore();

    useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent) => {
            // Prevent shortcuts when typing in input/textarea
            const target = e.target as HTMLElement;
            if (
                target.tagName === 'INPUT' ||
                target.tagName === 'TEXTAREA' ||
                target.isContentEditable
            ) {
                return;
            }

            switch (e.key) {
                case ' ':
                    e.preventDefault();
                    togglePlayPause();
                    break;

                case 'ArrowLeft':
                    e.preventDefault();
                    // Shift = 1 second, normal = 1 frame (~33ms @ 30fps)
                    seek(Math.max(0, currentTime - (e.shiftKey ? 1_000_000 : 33_333)));
                    break;

                case 'ArrowRight':
                    e.preventDefault();
                    seek(currentTime + (e.shiftKey ? 1_000_000 : 33_333));
                    break;

                case 'Home':
                    e.preventDefault();
                    seek(0);
                    break;

                case 'End':
                    e.preventDefault();
                    seek(usePlaybackStore.getState().duration);
                    break;

                case 'k':
                    // K key also toggles play/pause (like YouTube)
                    e.preventDefault();
                    togglePlayPause();
                    break;
            }
        };

        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, [togglePlayPause, seek, currentTime]);
}
