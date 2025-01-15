export interface HFFile {
    filename: string;
    size: number;
    sha256: string;
    url: string;
}

export interface ONNXWeight {
    name: string;
    shape: bigint[];
    data: Float32Array | Int32Array | Uint8Array;
}

export interface ONNXModel {
    weights: { [key: string]: ONNXWeight };
    graph: any; // The complete graph information if needed
}
