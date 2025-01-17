import { Float16Array } from "@petamoriken/float16";
import { GraphProto } from "./gen/onnx_pb.ts";

export interface FetchedFile {
    filename: string;
    sha256?: string;
    url: string;
    size?: number;
}

export interface ONNXWeight {
    name: string;
    shape: bigint[];
    data: Float32Array | Float16Array | Int32Array | Uint8Array | Int8Array | Uint16Array | Int16Array | BigInt64Array;
}

export interface ONNXModel {
    weights: { [key: string]: ONNXWeight };
    graph: GraphProto; // The complete graph information if needed
}
