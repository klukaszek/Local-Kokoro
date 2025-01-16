import { ensureDir } from "@std/fs";
import { join } from "@std/path";
import { fromBinary, Message } from "@bufbuild/protobuf";
import { Float16Array, getFloat16 } from "@petamoriken/float16";
import { ModelProto, ModelProtoSchema } from "../gen/onnx_pb.ts";
import { ONNXFile, ONNXModel, ONNXWeight } from "../types.ts";

export class ONNXLoader {
    private cacheDir: string;
    private modelId: string;

    // For the sake of this project I have this setup to
    constructor(modelId: string, cacheDir = "./.cache") {
        this.cacheDir = cacheDir;
        this.modelId = modelId;
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

    static async verifyChecksum(
        data: ArrayBuffer,
        expectedSha256: string,
    ): Promise<boolean> {
        const hashBuffer = await crypto.subtle.digest("SHA-256", data);
        const hashArray = Array.from(new Uint8Array(hashBuffer));
        const hashHex = hashArray.map((b) => b.toString(16).padStart(2, "0")).join(
            "",
        );
        console.log(`Checksum: ${hashHex}`);
        console.log(`Expected: ${expectedSha256}`);
        return hashHex === expectedSha256;
    }

    // Given an ONNXFile, fetch the weights from the URL
    async fetchWeights(info: ONNXFile): Promise<ArrayBuffer> {
        // Try loading from cache first
        const cachedData = await this.loadFromCache(info.filename);
        if (cachedData) {
            console.log(`Loaded ${info.filename} from cache`);

            // Verify checksum even for cached data
            if (
                info.sha256 &&
                !(await ONNXLoader.verifyChecksum(cachedData, info.sha256))
            ) {
                console.warn("Cache checksum mismatch, refetching...");
            } else {
                return cachedData;
            }
        }

        try {
            // Make request with proper headers for large file download
            const response = await fetch(info.url, {
                method: "GET",
                headers: {
                    "Accept": "application/octet-stream",
                },
            });

            if (!response.ok) {
                throw new Error(`Failed to load weights: ${response.statusText}`);
            }

            const contentLength = response.headers.get("content-length");
            const totalBytes = contentLength
                ? parseInt(contentLength, 10)
                : undefined;

            if (!response.body) {
                throw new Error("Response body is null");
            }

            const reader = response.body.getReader();
            const chunks: Uint8Array[] = [];
            let loadedBytes = 0;

            // Read the stream chunks
            while (true) {
                const { done, value } = await reader.read();

                if (done) {
                    // Verify we got all the data if we know the expected size
                    if (totalBytes && loadedBytes < totalBytes) {
                        throw new Error(
                            `Incomplete download: got ${loadedBytes} bytes, expected ${totalBytes} bytes`,
                        );
                    }
                    break;
                }

                chunks.push(value);
                loadedBytes += value.length;

                // Report progress
                if (totalBytes) {
                    const progress = ((loadedBytes / totalBytes) * 100).toFixed(1);
                    console.clear();
                    console.log(
                        `Loaded ${loadedBytes}/${totalBytes} bytes (${progress}%)`,
                    );
                } else {
                    console.log(`Loaded ${loadedBytes} bytes`);
                }
            }

            // Combine all chunks into final buffer
            const weightData = new Uint8Array(loadedBytes);
            let offset = 0;
            for (const chunk of chunks) {
                weightData.set(chunk, offset);
                offset += chunk.length;
            }

            // Verify total size if we know it
            if (totalBytes && weightData.byteLength !== totalBytes) {
                throw new Error(
                    `Size mismatch: got ${weightData.byteLength} bytes, expected ${totalBytes} bytes`,
                );
            }

            // Verify checksum if provided
            if (
                info.sha256 &&
                !(await ONNXLoader.verifyChecksum(weightData.buffer, info.sha256))
            ) {
                throw new Error("Checksum verification failed");
            }

            // Save to cache if download was successful
            await this.saveToCache(info.filename, weightData.buffer);

            return weightData.buffer;
        } catch (error) {
            console.error("Error loading weights:", error);
            throw error;
        }
    }

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
            let data: Float32Array | Int32Array | Int16Array | Uint8Array | Int8Array | Uint16Array | Float16Array | BigInt64Array;

            // Align the buffer if necessary
            const rawData = initializer.rawData;
            const alignedBuffer = rawData.byteLength % rawData.BYTES_PER_ELEMENT === 0
                ? rawData.buffer
                : rawData.slice().buffer;

            console.log(`Processing: ${name} with shape: [${dims}]`);
            if (rawData.byteLength === 0) {
                console.warn(`Skipping empty weight: ${name}`);
                continue;
            }

            let bpe = rawData.BYTES_PER_ELEMENT;
            switch (initializer.dataType) {
                case 1: // FLOAT
                    bpe = 4;
                    data = new Float32Array(
                        rawData.buffer,
                        Float32Array.BYTES_PER_ELEMENT,
                        rawData.byteLength / Float32Array.BYTES_PER_ELEMENT,
                    );
                    break;
                case 2: // UINT8
                    bpe = 1;
                    data = new Uint8Array(
                        rawData.buffer,
                        Uint8Array.BYTES_PER_ELEMENT,
                        rawData.byteLength / Uint8Array.BYTES_PER_ELEMENT,
                    );
                    break;
                case 3:
                    bpe = 1;
                    data = new Int8Array(
                        alignedBuffer,
                        Int8Array.BYTES_PER_ELEMENT,
                        rawData.byteLength / Int8Array.BYTES_PER_ELEMENT,
                    );
                    break;
                case 4: // UINT16
                    bpe = 2;
                    data = new Uint16Array(
                        alignedBuffer,
                        Uint16Array.BYTES_PER_ELEMENT,
                        rawData.byteLength / Uint16Array.BYTES_PER_ELEMENT,
                    );
                    break;
                case 5: // INT16
                    bpe = 2;
                    data = new Int16Array(
                        alignedBuffer,
                        Int16Array.BYTES_PER_ELEMENT,
                        rawData.byteLength / Int16Array.BYTES_PER_ELEMENT,
                    );
                    break;
                case 6: // INT32
                    bpe = 4;
                    data = new Int32Array(
                        alignedBuffer,
                        bpe,
                        rawData.byteLength / bpe,
                    );
                    break;
                case 7: // INT64
                    bpe = 8;
                    data = new BigInt64Array(alignedBuffer, bpe, rawData.byteLength / bpe);
                    break;
                case 10: // FLOAT16
                    bpe = 2;
                    data = new Float16Array(alignedBuffer, bpe, rawData.byteLength / bpe);
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
}
