import { Float16Array } from "@petamoriken/float16";
import * as ort from "npm:onnxruntime-web/webgpu";
import { GraphProto } from "./gen/onnx_pb.ts";
import { AudioManager } from "./audio.ts";

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

export interface Voice {
    name: string;
    filename: string;
    language: string;
    data: Float32Array | null;
}

export interface KokoroContext {
    rawModelData: ArrayBuffer | null; // Stores the raw ONNX model weights
    ortSession: ort.InferenceSession | null; // Stores the ORT inference session
    audioManager: AudioManager | null; // Stores the audio context
}

export interface CachedAudio {
    data: ArrayBuffer;
    timestamp: number;
    voice: string;
    message: string;
}

// Standard tokenizer configuration schema used by most Hugging Face models 
export interface TokenizerConfig {
    version: string;
    truncation: null;
    padding: null;
    added_tokens: string[];
    decoder: null;
    model: {
        vocab: Record<string, number>;
    };
    normalizer: {
        type: string;
        pattern: {
            Regex: string;
        };
    };
    pre_tokenizer: {
        type: string;
        pattern: {
            Regex: string;
        };
        behavior: string;
        invert: boolean;
    };
    post_processor: {
        type: string;
        single: Array<{
            SpecialToken?: {
                id: string;
                type_id: number;
            };
            Sequence?: {
                id: string;
                type_id: number;
            };
        }>;
        special_tokens: {
            [key: string]: {
                id: string;
                ids: number[];
                tokens: string[];
            };
        };
    };
}
