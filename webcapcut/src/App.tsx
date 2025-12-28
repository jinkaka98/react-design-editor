import { useState } from 'react';
import { VideoPlayer } from './ui/VideoPlayer';
import { Timeline } from './ui/timeline/Timeline';
import { MediaPanel } from './ui/media/MediaPanel';
import { useTimelineStore } from './store/timelineStore';
import { ResolutionDropdown } from './ui/controls/ResolutionSelector';
import { ExportDialog } from './ui/export/ExportDialog';

function App() {
  const tracks = useTimelineStore(state => state.tracks);
  const assets = useTimelineStore(state => state.assets);

  const [isExportOpen, setIsExportOpen] = useState(false);

  const hasClips = tracks.some(t => t.segments.some(s => s.type === 'clip'));

  return (
    <div className="h-screen flex flex-col bg-gray-900 text-white overflow-hidden">
      {/* Header */}
      <header className="bg-gray-800 px-4 py-3 shadow-lg flex-shrink-0 border-b border-gray-700">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-xl font-bold">WebCapCut</h1>
            <p className="text-xs text-gray-400">Multi-Track Video Editor</p>
          </div>

          {/* Actions */}
          <div className="flex items-center gap-3">
            {/* Resolution selector */}
            <ResolutionDropdown />

            <span className="text-xs text-gray-500">
              {assets.size} assets, {tracks.reduce((sum, t) => sum + t.segments.filter(s => s.type === 'clip').length, 0)} clips
            </span>

            {/* Export Button */}
            <button
              onClick={() => setIsExportOpen(true)}
              disabled={!hasClips}
              className={`px-4 py-2 rounded text-sm font-medium transition-colors flex items-center gap-2
                          ${hasClips
                  ? 'bg-green-600 hover:bg-green-500'
                  : 'bg-gray-600 cursor-not-allowed opacity-50'}`}
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" />
              </svg>
              Export
            </button>
          </div>
        </div>
      </header>

      {/* Main content with sidebar */}
      <main className="flex-1 flex overflow-hidden">
        {/* Media Panel Sidebar */}
        <MediaPanel />

        {/* Preview + Timeline */}
        <div className="flex-1 flex flex-col overflow-hidden">
          {/* Preview area */}
          <div className="flex-1 flex items-center justify-center bg-black min-h-0 overflow-hidden">
            {hasClips ? (
              <VideoPlayer />
            ) : (
              <div className="text-gray-500 text-center">
                <svg className="w-16 h-16 mx-auto mb-4 opacity-50" fill="currentColor" viewBox="0 0 20 20">
                  <path d="M2 6a2 2 0 012-2h6a2 2 0 012 2v8a2 2 0 01-2 2H4a2 2 0 01-2-2V6zM14.553 7.106A1 1 0 0014 8v4a1 1 0 00.553.894l2 1A1 1 0 0018 13V7a1 1 0 00-1.447-.894l-2 1z" />
                </svg>
                <p className="text-lg mb-2">No clips in timeline</p>
                <p className="text-sm">Add media from the panel, then double-click to add to timeline</p>
              </div>
            )}
          </div>

          {/* Timeline */}
          <div className="h-48 flex-shrink-0 border-t border-gray-700">
            <Timeline />
          </div>
        </div>
      </main>

      {/* Export Dialog */}
      <ExportDialog isOpen={isExportOpen} onClose={() => setIsExportOpen(false)} />
    </div>
  );
}

export default App;
