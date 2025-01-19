import * as ort from "npm:onnxruntime-web/webgpu";
import { render, h } from "npm:preact";
import { App } from "./ui/App.tsx";
import { fetchVoices } from "./voices.ts";
import { Fetcher } from "./loaders/files.ts";
import { ONNXLoader } from "./loaders/onnx.ts";
import { updateProgress } from "./ui/state/progress.ts";
import { KokoroContext, createKokoroContext } from "./types.ts";
import { AudioManager } from "./audio.ts";

render(h(App, {}), document.getElementById("app")!);

export const CONTEXT: KokoroContext = createKokoroContext();

(async function init() {
    try {
        // Initialize ONNXLoader
        const loader = new ONNXLoader("hexgrad/Kokoro-82M");

        // Define the model file
        const model_file = {
            "filename": "model_q8f16.onnx",
            "url": "https://huggingface.co/onnx-community/Kokoro-82M-ONNX/resolve/main/onnx/model_uint8f16.onnx",
            "sha256": "071acda679aaa31dcd551c57dabb99190f5e126b2f76bf88621dfe69b2aa9a2d",
        };

        // Fetch raw model weights
        CONTEXT.rawModelData = await Fetcher.fetchFile(
            model_file,
            updateProgress,
        );

        CONTEXT.audioManager = new AudioManager(await fetchVoices(updateProgress));

        // Parse raw weights into ONNX model
        const onnxModel = loader.parseWeights(CONTEXT.rawModelData);
        if (!onnxModel) {
            throw new Error("Failed to parse ONNX model");
        }

        // Initialize ORT session
        ort.env.debug = true;
        ort.env.logLevel = "verbose";
        CONTEXT.ortSession = await ort.InferenceSession.create(CONTEXT.rawModelData, {"executionProviders": ["wasm"]});

        if (!CONTEXT.ortSession) {
            throw new Error("Failed to create ONNX session");
        }

        console.log("Initialization completed:", CONTEXT);
    } catch (error) {
        console.error("Failed to initialize:", error);
        throw error;
    }
})();

