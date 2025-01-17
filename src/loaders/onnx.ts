import { fromBinary } from "npm:@bufbuild/protobuf@^2.2.3";
import { Float16Array } from "jsr:@petamoriken/float16@^3.9.1";
import { ModelProtoSchema, TensorProto_DataType } from "../gen/onnx_pb.ts";
import { ONNXModel, ONNXWeight } from "../types.ts";

export class ONNXLoader {
  private cacheDir: string;
  private modelId: string;

  // For the sake of this project I have this setup to
  constructor(modelId: string, cacheDir = "./.cache") {}

  // Parses the binary ONNX data into an ONNXModel object based on the ONNX protobuf schema
  parseWeights(data: ArrayBuffer): ONNXModel {
    // Parse ONNX data using @bufbuild/protobuf
    const model = fromBinary(ModelProtoSchema, new Uint8Array(data));

    // Extract weights from the model's graph
    const weights: { [key: string]: ONNXWeight } = {};
    const graph = model.graph!;

    let i = 0;
    for (const initializer of graph.initializer) {
      const name = initializer.name!;
      const dims = initializer.dims!;
      let data:
        | Float32Array
        | Int32Array
        | Int16Array
        | Uint8Array
        | Int8Array
        | Uint16Array
        | Float16Array
        | BigInt64Array;

      // Align the buffer if necessary
      const rawData = initializer.rawData;
      const alignedBuffer = rawData.byteLength % rawData.BYTES_PER_ELEMENT === 0
        ? rawData.buffer
        : rawData.slice().buffer;

      //console.log(`Processing: ${name} with shape: [${dims}]`);
      if (rawData.byteLength === 0) {
        continue;
      }

      // Determine the data type and create the appropriate typed array according to the ONNX spec
      let bpe = rawData.BYTES_PER_ELEMENT;
      switch (initializer.dataType as TensorProto_DataType) {
        case TensorProto_DataType.FLOAT:
          bpe = 4;
          data = new Float32Array(
            alignedBuffer,
            bpe,
            rawData.byteLength / bpe,
          );
          break;
        case TensorProto_DataType.UINT8:
          bpe = 1;
          data = new Uint8Array(
            alignedBuffer,
            bpe,
            rawData.byteLength,
          );
          break;
        case TensorProto_DataType.INT8:
          bpe = 1;
          data = new Int8Array(
            alignedBuffer,
            bpe,
            rawData.byteLength,
          );
          break;
        case TensorProto_DataType.UINT16:
          bpe = 2;
          data = new Uint16Array(
            alignedBuffer,
            bpe,
            rawData.byteLength / bpe,
          );
          break;
        case TensorProto_DataType.INT16:
          bpe = 2;
          data = new Int16Array(
            alignedBuffer,
            bpe,
            rawData.byteLength / bpe,
          );
          break;
        case TensorProto_DataType.INT32:
          bpe = 4;
          data = new Int32Array(
            alignedBuffer,
            bpe,
            rawData.byteLength / bpe,
          );
          break;
        case TensorProto_DataType.INT64:
          bpe = 8;
          data = new BigInt64Array(
            alignedBuffer,
            bpe,
            rawData.byteLength / bpe,
          );
          break;
        case TensorProto_DataType.FLOAT16:
          bpe = 2;
          data = new Float16Array(alignedBuffer, bpe, rawData.byteLength / bpe);
          break;
        default:
          throw new Error(`Unsupported data type: ${initializer.dataType}`);
      }

      // Update our weights dictionary
      weights[name] = {
        name,
        shape: dims,
        data,
      };

      i++;
    }

    console.log(`Parsed ${i} weights from the ONNX model file.`);

    return {
      weights,
      graph,
    };
  }
}
