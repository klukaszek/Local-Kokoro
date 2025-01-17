//import { KokoroTTS } from "./inference/model.ts";
import { WebGPUDevice } from "./webgpu/device.ts";
import { ONNXLoader } from "./loaders/onnx.ts";
import * as ort from "npm:onnxruntime-web/webgpu";
import { Fetcher } from "./loaders/files.ts";
import { VOICES_FILES } from "./voices.ts";

(async function init() {
  try {
    // We give our model a name (ID) and pass it to the ONNXLoader for caching purposes
    const loader = new ONNXLoader("hexgrad/Kokoro-82M");

    // The File object contains the filename, URL, and checksum of the ONNX
    const model_file = {
      "filename": "model_q8f16.onnx",
      "url":
        "https://huggingface.co/onnx-community/Kokoro-82M-ONNX/resolve/main/onnx/model_uint8f16.onnx", // Use the quantized model from Xenova
      "sha256":
        "071acda679aaa31dcd551c57dabb99190f5e126b2f76bf88621dfe69b2aa9a2d",
    };

    // Fetch the weights from the URL and parse them into
    const rawWeights = await Fetcher.fetchFile(model_file);

    const voices = [];
    VOICES_FILES.forEach(async (voice) => {
      voices.push(await Fetcher.fetchFile(voice));
    });
    
    console.log(voices);


    // The rawWeights are then parsed into an ONNXModel object based on the ONNX protobuf schema
    const onnxModel = loader.parseWeights(rawWeights);
    if (!onnxModel) {
      throw new Error("Failed to parse ONNX model");
    }

    //// Traverse onnxModel.graph!.input and print the name and shape of each input
    //onnxModel.graph!.input.map((input) => {
    //        const shape = input.type!.value.value.shape!;
    //        console.log(`Input: `, shape);
    //    });

    const session = await new ort.InferenceSession(
      rawWeights,
      {
        backendHint: "webgpu",
      },
    );

    console.log(session);

    const inputs = onnxModel.graph!.input;

    // We must create dictionaries for the inputs and outputs
    // inputs contains the key for the input, but the shape is nested within
    // type -> value -> value -> shape -> dim
    // we must extract the values from the dim array, and convert them to numbers from bigints
    // the values are stored under 'value' -> 'value' for each element of the dim array

    //const dict = {};
    //inputs.forEach((input) => {
    //  const shape = input.type!.value.value.shape!.dim.map((dim) =>
    //    Number(dim.value!.value)
    //  );
    //  dict[input.name] = shape;
    //});
    //
    //for (const [key, value] of Object.entries(dict)) {
    //  console.log(`${key}: ${value}`);
    //}

    //const outputs = onnxModel.graph!.output;

    //console.log("Inputs: ", inputs);

    if (!session) {
      throw new Error("Failed to create ONNX session");
    }

    const device = await WebGPUDevice.init();

    console.log("Model Parsed!");
  } catch (error) {
    console.error("Failed to initialize:", error);
    throw error;
  }
})();
