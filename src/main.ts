import { KokoroTTS } from "./inference/model.ts";
import { WebGPUDevice } from "./webgpu/device.ts";
import { HuggingFaceLoader } from "./loaders/huggingface.ts";
import { InferenceSession } from "onnxruntime-web"

export default { fetch };

async function main() {
    try {
        // Initialize WebGPU
        //const device = await WebGPUDevice.init();

        const loader = new HuggingFaceLoader();
        const onnxModel = await loader.loadONNX([
            {
                "filename": "kokoro-v0_19.onnx",
                "url":
                    "https://huggingface.co/hexgrad/Kokoro-82M/blob/main/kokoro-v0_19.onnx",
                "sha256":
                    "ebef42457f7efee9b60b4f1d5aec7692f2925923948a0d7a2a49d2c9edf57e49",
            },
        ]);

        //console.log("ONNX: ", onnxModel);

        console.log("Model Parsed!");
        //return model;
    } catch (error) {
        console.error("Failed to initialize:", error);
        throw error;
    }
}

if (import.meta.main) {
    main();
}
