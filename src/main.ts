import { KokoroTTS } from "./inference/model.ts";
import { WebGPUDevice } from "./webgpu/device.ts";
import { ONNXLoader } from "./loaders/onnx.ts";
import * as onnxruntime from "onnxruntime-web"

async function main() {
  try {
    //const device = await WebGPUDevice.init();
    
    // We give our model a name (ID) and pass it to the ONNXLoader for caching purposes
    const loader = new ONNXLoader("hexgrad/Kokoro-82M");
    
    // The ONNXFile object contains the filename, URL, and checksum of the ONNX
    const info = {
      "filename": "model_q8f16.onnx",
      "url":
        "https://huggingface.co/onnx-community/Kokoro-82M-ONNX/resolve/main/onnx/model_q8f16.onnx", // Use the quantized model from Xenova
      "sha256":
        "6e4e74139c6f1445f34428cad44206e8bdc7c4d703954d3248f5865c03379f86",
    };
    
    // Fetch the weights from the URL and parse them into
    const rawWeights = await loader.fetchWeights(info);

    // The rawWeights are then parsed into an ONNXModel object based on the ONNX protobuf schema
    const onnxModel = loader.parseWeights(rawWeights);
    if (!onnxModel) {
      throw new Error("Failed to parse ONNX model");
    }

    //onnxruntime.InferenceSession.create('./.cache/hexgrad/Kokoro-82M/kokoro-v0_19.onnx').then((session) => {
    //    console.log("Session Created!");
    //    });

    //console.log("onnxModel:", onnxModel);

    console.log("Model Parsed!");
  } catch (error) {
    console.error("Failed to initialize:", error);
    throw error;
  }
}

if (import.meta.main) {
  main();
}
