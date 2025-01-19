import * as ort from "npm:onnxruntime-web/webgpu";
import { render, h } from "npm:preact";
import { App } from "./ui/App.tsx";
import { fetchVoices } from "./voices.ts";
import { Fetcher } from "./loaders/files.ts";
import { ONNXLoader } from "./loaders/onnx.ts";
import { updateProgress } from "./ui/state/progress.ts";
import { KokoroContext } from "./types.ts";
import { AudioManager } from "./audio.ts";


render(h(App, {}), document.getElementById("app")!);

// Initialize the state object
const createKokoroContext = async (): Promise<KokoroContext> => ({
    rawModelData: null,
    ortSession: null,
    audioManager: null,
});

export const CONTEXT: KokoroContext = await createKokoroContext();

(async function init() {
    try {
        // Initialize ONNXLoader
        const loader = new ONNXLoader("hexgrad/Kokoro-82M");

        // Define the model file
        const model_file = {
            "filename": "model_q8f16.onnx",
            "url": "https://huggingface.co/onnx-community/Kokoro-82M-ONNX/resolve/main/onnx/model_q8f16.onnx",
            "sha256": "6e4e74139c6f1445f34428cad44206e8bdc7c4d703954d3248f5865c03379f86",
        };

        // Fetch raw model weights
        CONTEXT.rawModelData = await Fetcher.fetchFile(
            model_file,
            updateProgress,
        );

        // Fetch voices and initialize AudioManager
        CONTEXT.audioManager = new AudioManager(await fetchVoices(updateProgress));

        // Parse raw weights into ONNX model
        const onnxModel = loader.parseWeights(CONTEXT.rawModelData);
        if (!onnxModel) {
            throw new Error("Failed to parse ONNX model");
        }

        // Initialize ORT session
        ort.env.debug = true;
        ort.env.logLevel = "verbose";
        CONTEXT.ortSession = await ort.InferenceSession.create(CONTEXT.rawModelData, {"executionProviders": ['wasm']});

        if (!CONTEXT.ortSession) {
            throw new Error("Failed to create ONNX session");
        }

        console.log("Initialization completed:", CONTEXT);
    } catch (error) {
        console.error("Failed to initialize:", error);
        throw error;
    }
})();

