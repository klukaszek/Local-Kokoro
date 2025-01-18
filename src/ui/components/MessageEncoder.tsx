/** @jsxRuntime automatic */
/** @jsxImportSource https://esm.sh/preact */
import { h } from "https://esm.sh/preact";
import { useState } from "npm:preact/hooks";
import { encode } from "../../loaders/tokenizer.ts";
import { KokoroContext } from "../../types.ts";
import * as ort from "npm:onnxruntime-web/webgpu";
import { CONTEXT } from "../../main.ts";

interface MessageEncoderProps {
    context: KokoroContext;
}

export function MessageEncoder({ context }: MessageEncoderProps) {
    const [input, setInput] = useState('');
    const [encodedTokens, setEncodedTokens] = useState<number[]>([]);
    const [inferenceResult, setInferenceResult] = useState<string>('');
    const [isLoading, setIsLoading] = useState(false);

    const handleInputChange = (event: Event) => {
        const target = event.target as HTMLInputElement;
        const newInput = target.value;
        setInput(newInput);
        // Tokenize and encode input text
        const locale = context.currentVoice?.language === 'en-us' ? 'a' : 'b';
        const tokens = encode(newInput, locale, true);
        setEncodedTokens(tokens);
    };

    const createTensorAndInfer = async () => {
        if (!context.ortSession) {
            setInferenceResult('Error: No ORT session available');
            return;
        }

        try {
            setIsLoading(true);

            if (encodedTokens.length === 0) {
                setInferenceResult('Error: No tokens to encode');
                return;
            }

            if (encodedTokens.length > 510) {
                setInferenceResult('Warning: Input length exceeds 510 tokens. Out of range for the model.');
                return;
            }

            // Convertg encoded tokens to BigInt
            const encodedTokensBigInt = encodedTokens.map((token) => BigInt(token));

            // Add a zero to the start and the end of the encoded tokens. 
            const paddedTokens = [0n, ...encodedTokensBigInt, 0n];

            // Create input tensor
            const inputTensor = new ort.Tensor(
                'int64',                    // data type
                BigInt64Array.from(paddedTokens), // convert to Int32Array
                [1, paddedTokens.length]   // shape [batch_size, sequence_length]
            );

            console.log('Input tensor:', inputTensor);

            const startIdx = paddedTokens.length;
            const data = new Float32Array(256).fill(0.0);
            const slice = data.slice(startIdx, startIdx + 256);
            data.set(slice, 0);
            const ref_s = new ort.Tensor('float32', data, [1, data.length]); 

            console.log('Reference tensor:', ref_s);

            // Run inference
            const feeds = { 
                'input_ids': inputTensor,
                'style': ref_s,
                'speed': new ort.Tensor('float32', new Float32Array([1.0]), [1]),
            };

            const results = await context.ortSession.run(feeds);
            const audio = results[Object.keys(results)[0]].data;
            CONTEXT.audioCache.push({ key: input, data: audio, timestamp: Date.now() });
            setInferenceResult(`Inference complete! Audio length: ${audio.length}`);
        } catch (error) {
            setInferenceResult(`Error during inference: ${error.message}`);
        } finally {
            setIsLoading(false);
        }
    };

    return (
        <div className="p-4">
            <h1 className="text-2xl mb-4">Message Encoder</h1>
            <textarea
                placeholder="Enter your message..."
                value={input}
                onInput={handleInputChange}
                className="w-full h-24 mb-4 p-2 border rounded"
            />
            <div className="mb-4">
                <h2 className="text-xl mb-2">Encoded Tokens</h2>
                <p className="break-words">{encodedTokens.join(' ')}</p>
            </div>
            <button
                onClick={createTensorAndInfer}
                disabled={isLoading || encodedTokens.length === 0}
                className="bg-blue-500 text-white px-4 py-2 rounded disabled:bg-gray-300"
            >
                {isLoading ? 'Processing...' : 'Run Inference'}
            </button>
            {inferenceResult && (
                <div className="mt-4">
                    <h2 className="text-xl mb-2">Inference Result</h2>
                    <p>{inferenceResult}</p>
                </div>
            )}
        </div>
    );
}
