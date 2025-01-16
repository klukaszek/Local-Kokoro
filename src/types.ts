import { Float16Array } from "@petamoriken/float16";

export interface ONNXFile {
    filename: string;
    sha256: string;
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
    graph: any; // The complete graph information if needed
}
