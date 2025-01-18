import { Voice } from "./types.ts";
import { Fetcher } from "./loaders/files.ts";
import { FetchedFile } from "./types.ts";

const url =
    "https://huggingface.co/onnx-community/Kokoro-82M-ONNX/resolve/main/voices/";

const VOICES_FILES: Voice[] = [
    {
        "name": "Default",
        "filename": "af.bin",
        "language": "en-us",
        "data": null,
    },
    {
        "name": "Bella",
        "filename": "af_bella.bin",
        "language": "en-us",
        "data": null,
    },
    {
        "name": "Nicole",
        "filename": "af_nicole.bin",
        "language": "en-us",
        "data": null,
    },
    {
        "name": "Sarah",
        "filename": "af_sarah.bin",
        "language": "en-us",
        "data": null,
    },
    {
        "name": "Sky",
        "filename": "af_sky.bin",
        "language": "en-us",
        "data": null,
    },
    {
        "name": "Adam",
        "filename": "am_adam.bin",
        "language": "en-us",
        "data": null,
    },
    {
        "name": "Michael",
        "filename": "am_michael.bin",
        "language": "en-us",
        "data": null,
    },
    {
        "name": "Emma",
        "filename": "bf_emma.bin",
        "language": "en-gb",
        "data": null,
    },
    {
        "name": "Isabella",
        "filename": "bf_isabella.bin",
        "language": "en-gb",
        "data": null,
    },
    {
        "name": "George",
        "filename": "bm_george.bin",
        "language": "en-gb",
        "data": null,
    },
    {
        "name": "Lewis",
        "filename": "bm_lewis.bin",
        "language": "en-gb",
        "data": null,
    },
];

export const fetchVoices = async (
    updateProgress: (name: string, loaded: number, total: number) => void,
): Promise<Voice[]> => {
    const voices: Voice[] = [];
    for (let i = 0; i < VOICES_FILES.length; i++) {
        const file: FetchedFile = {
            "filename": VOICES_FILES[i].filename,
            "url": url + VOICES_FILES[i].filename,
        }
        const voiceData = await Fetcher.fetchFile(file, updateProgress);
        voices.push({ ...VOICES_FILES[i], data: voiceData });
    }
    return voices;
};
