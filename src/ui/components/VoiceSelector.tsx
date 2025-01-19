/** @jsxRuntime automatic */
/** @jsxImportSource https://esm.sh/preact */
import { h } from "https://esm.sh/preact";
import { VOICES_FILES } from "../../voices.ts";
import type { KokoroContext } from "../../types.ts";

interface VoiceSelectorProps {
    context: KokoroContext;
}

export function VoiceSelector({ context }: VoiceSelectorProps) {
    const handleVoiceChange = (event: h.JSX.TargetedEvent<HTMLSelectElement, Event>) => {
        if (context.audioManager) {
            context.audioManager.changeVoice(event.currentTarget.value);
        }
    };

    return (
        <div class="mt-4">
            <label for="voice-select" class="block text-sm font-medium text-gray-700 mb-2">
                Select Voice
            </label>
            <select
                id="voice-select"
                class="block w-full px-3 py-2 bg-white border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                onChange={handleVoiceChange}
                defaultValue="Default"
            >
                {VOICES_FILES.map((voice) => (
                    <option key={voice.name} value={voice.name}>
                        {voice.name} ({voice.language})
                    </option>
                ))}
            </select>
        </div>
    );
}
