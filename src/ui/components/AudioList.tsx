/** @jsxRuntime automatic */
/** @jsxImportSource https://esm.sh/preact */
import { h } from "npm:preact";
import { useEffect, useMemo, useState } from "npm:preact/hooks";
import { KokoroContext } from "../../types.ts";
import { WavConverter } from "../../audio.ts";

interface AudioManagerContext {
  context: KokoroContext;
}

interface AudioEntry {
  id: string;
  url: string;
  voice: string;
}

export function AudioList({ context }: AudioManagerContext) {
  const [selectedVoice, setSelectedVoice] = useState<string>("all");
  const [updateTrigger, setUpdateTrigger] = useState(0);
  const [isInitialized, setIsInitialized] = useState(false);

  // Check for audioManager initialization
  useEffect(() => {
    if (context?.audioManager) {
      setIsInitialized(true);
    } else {
      // Poll for audioManager every second until it's available
      const checkInterval = setInterval(() => {
        if (context?.audioManager) {
          setIsInitialized(true);
          clearInterval(checkInterval);
        }
      }, 1000);

      return () => clearInterval(checkInterval);
    }
  }, [context]);

  // Set up update listener
  useEffect(() => {
    if (!context?.audioManager) return;

    const handleUpdate = () => {
      setUpdateTrigger(prev => prev + 1);
    };
    
    // Add listener and trigger initial update
    context.audioManager.addUpdateListener(handleUpdate);
    handleUpdate(); // Force initial update

    return () => {
      context.audioManager?.removeUpdateListener(handleUpdate);
    };
  }, [context?.audioManager]);

  // Convert audio data to URLs and manage cleanup
  const audioEntries = useMemo(() => {
    if (!context?.audioManager?.getCache()) return [];

    const entries: AudioEntry[] = [];
    const audioCache = context.audioManager.getCache();
    
    audioCache.forEach((audio, key) => {
      const voiceName = audio.voice || 'Default';
      const blob = WavConverter.convertToWav(audio);
      const url = URL.createObjectURL(blob);
      entries.push({ 
        id: key,
        url,
        voice: voiceName
      });
    });
    
    return entries;
  }, [context?.audioManager?.getCache(), updateTrigger]);

  // Filter entries by selected voice
  const filteredEntries = useMemo(() => {
    if (selectedVoice === "all") return audioEntries;
    return audioEntries.filter(entry => entry.voice === selectedVoice);
  }, [audioEntries, selectedVoice]);

  // Get unique voice names for the filter dropdown
  const voiceOptions = useMemo(() => {
    const voices = new Set(audioEntries.map(entry => entry.voice));
    return ["all", ...Array.from(voices)];
  }, [audioEntries]);

  // Cleanup URLs when component unmounts or audioCache changes
  useEffect(() => {
    return () => {
      audioEntries.forEach(entry => {
        URL.revokeObjectURL(entry.url);
      });
    };
  }, [audioEntries]);

  // Loading state
  if (!isInitialized) {
    return (
      <div class="space-y-4 w-full max-w-md p-4 overflow-y-auto max-h-screen">
        <div class="text-center text-gray-500 py-8">
          Initializing audio manager...
        </div>
      </div>
    );
  }

  return (
    <div class="space-y-4 w-full max-w-md p-4 overflow-y-auto max-h-screen">
      {/* Voice filter dropdown - Only show if there are entries */}
      {audioEntries.length > 0 && (
        <div class="mb-4">
          <select 
            value={selectedVoice}
            onChange={(e) => setSelectedVoice(e.currentTarget.value)}
            class="w-full p-2 border border-gray-300 rounded-md shadow-sm focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
          >
            {voiceOptions.map(voice => (
              <option key={voice} value={voice}>
                {voice === "all" ? "All Voices" : voice}
              </option>
            ))}
          </select>
        </div>
      )}

      {/* Audio players */}
      {filteredEntries.toReversed().map((entry) => (
        <div key={entry.id} class="w-full bg-white rounded-lg shadow p-4">
          <div class="mb-2 flex justify-between items-center">
            <span class="text-sm font-medium text-gray-700 truncate flex-1">
              Generated Audio
            </span>
            <span class="text-xs text-gray-500 ml-2">
              {entry.voice}
            </span>
          </div>
          <audio 
            controls 
            src={entry.url}
            class="w-full"
            preload="metadata"
          >
            Your browser does not support the audio element.
          </audio>
        </div>
      ))}
      
      {filteredEntries.length === 0 && (
        <div class="text-center text-gray-500 py-8">
          {audioEntries.length === 0 
            ? "No audio generated yet"
            : "No audio found for selected voice"
          }
        </div>
      )}
    </div>
  );
}
