import { ensureDir } from "@std/fs";
import { join } from "@std/path";
import { fromBinary, Message } from "@bufbuild/protobuf";
import { ModelProto, ModelProtoSchema } from "../gen/onnx_pb.ts";
import { ONNXModel, ONNXWeight } from "../types.ts";

export class HuggingFaceLoader {
    private cacheDir: string;
    private modelId = "hexgrad/Kokoro-82M";

    constructor(cacheDir = "./.cache") {
        this.cacheDir = cacheDir;
    }

    private async saveToCache(filename: string, data: ArrayBuffer) {
        const filePath = join(this.cacheDir, this.modelId, filename);
        await ensureDir(join(this.cacheDir, this.modelId));
        await Deno.writeFile(filePath, new Uint8Array(data));
    }

    private async loadFromCache(filename: string): Promise<ArrayBuffer | null> {
        try {
            const filePath = join(this.cacheDir, this.modelId, filename);
            const data = await Deno.readFile(filePath);
            return data.buffer;
        } catch {
            return null;
        }
    }

    private async verifyChecksum(
        data: ArrayBuffer,
        expectedSha256: string,
    ): Promise<boolean> {
        const hashBuffer = await crypto.subtle.digest("SHA-256", data);
        const hashArray = Array.from(new Uint8Array(hashBuffer));
        const hashHex = hashArray.map((b) => b.toString(16).padStart(2, "0")).join(
            "",
        );
        return hashHex === expectedSha256;
    }

    async loadONNX(
        files: { filename: string; url: string; sha256: string }[],
    ): Promise<ONNXModel> {
        for (const file of files) {
            console.log(`Processing ${file.filename}...`);

            // Try loading from cache first
            let data = await this.loadFromCache(file.filename);

            if (!data || !await this.verifyChecksum(data, file.sha256)) {
                // Download if not in cache or checksum mismatch
                data = await this.fetchWeights(file.url);

                // Verify downloaded data
                if (!await this.verifyChecksum(data, file.sha256)) {
                    throw new Error(`Checksum mismatch for ${file.filename}`);
                }

                // Save to cache
                await this.saveToCache(file.filename, data);
            }

            // Parse the ONNX file and return the model
            return this.parseONNX(data);
        }

        throw new Error("No ONNX files found in the provided list.");
    }

    private parseONNX(data: ArrayBuffer): ONNXModel {
        // Parse ONNX data using @bufbuild/protobuf
        const model = fromBinary(ModelProtoSchema, new Uint8Array(data));

        // Extract weights from the model's graph
        const weights: { [key: string]: ONNXWeight } = {};
        const graph = model.graph!;

        let i = 0;
        for (const initializer of graph.initializer) {
            const name = initializer.name!;
            const dims = initializer.dims!;
            let data: Float32Array | Int32Array | Uint8Array;

            // Align the buffer if necessary
            const rawData = initializer.rawData;
            const alignedBuffer = rawData.byteLength % 4 === 0
                ? rawData.buffer
                : rawData.slice().buffer;

            console.log(`Processing weight: ${name} with shape: [${dims}]`);

            // Retrieve the data based on the data type
            // I just picked the most likely I might use in the future
            // even though the Kokoro-82M model will use FLOAT
            switch (initializer.dataType) {
                case 1: // FLOAT
                    data = new Float32Array(
                        rawData.buffer,
                        4,
                        rawData.byteLength / Float32Array.BYTES_PER_ELEMENT,
                    );
                    break;
                case 2: // UINT8
                    data = new Uint8Array(
                        rawData.buffer,
                        rawData.byteOffset,
                        rawData.byteLength / Uint8Array.BYTES_PER_ELEMENT,
                    );
                    break;
                case 5: // INT32
                    data = new Int32Array(
                        alignedBuffer,
                        rawData.byteOffset,
                        rawData.byteLength / Int32Array.BYTES_PER_ELEMENT,
                    );
                    break;
                default:
                    throw new Error(`Unsupported data type: ${initializer.dataType}`);
            }

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

    async fetchWeights(url: string): Promise<ArrayBuffer> {
        try {
            const response = await fetch(url);
            if (!response.ok) {
                throw new Error(`Failed to load weights: ${response.statusText}`);
            }

            const weightData = await response.arrayBuffer();
            return weightData;
        } catch (error) {
            console.error("Error loading weights:", error);
            throw error;
        }
    }
}
