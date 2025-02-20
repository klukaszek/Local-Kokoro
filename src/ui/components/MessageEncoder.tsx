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

// TODO: Update component to only perform encoding when button is pressed by user.
// Sort out more issues with weird cases of encoding:
// "Life is like a box of chocolates. You never know what you're gonna get".
//              -> George, Sarah, and Emma return NaNs with the "." at the end of the sentence.

export function MessageEncoder({ context }: MessageEncoderProps) {
  const [input, setInput] = useState("");
  const [inferenceResult, setInferenceResult] = useState<string>("");
  const [isLoading, setIsLoading] = useState(false);

  const handleInputChange = async (event: Event) => {
    const target = event.target as HTMLInputElement;
    const newInput = target.value;
    setInput(newInput);
  };

  const createTensorAndInfer = async () => {
    if (!context.ortSession) {
      setInferenceResult("Error: No ORT session available");
      return;
    }

    try {
      setIsLoading(true);

      const voice = context.audioManager?.getCurrentVoice();
      // Tokenize and encode input text
      const locale = voice?.language === "en-us" ? "a" : "b";
      const tokens = await encode(input, locale, true);
      const encodedTokens = tokens.tokens;

      if (encodedTokens.length === 0) {
        setInferenceResult("Error: No tokens to encode");
        return;
      }

      if (encodedTokens.length > 510) {
        setInferenceResult(
          "Warning: Input length exceeds 510 tokens. Out of range for the model.",
        );
        return;
      }

      const audioManager = CONTEXT.audioManager;
      if (!audioManager) {
        setInferenceResult("Error: No audio manager available");
        return;
      }

      if (audioManager.getCachedAudio(encodedTokens)) {
        setInferenceResult("Audio already cached for these tokens");
      } else {
        // Debug voice data
        const voice = CONTEXT.audioManager?.getCurrentVoice();
        const voiceData = voice?.data;

        console.log(voice);

        const encodedTokensBigInt = encodedTokens.map((token: number) =>
          BigInt(token)
        );

        console.log(encodedTokens);

        const paddedTokens = [0n, ...encodedTokensBigInt, 0n];

        // We generate our ONNX tensor from the padded tokens
        const inputTensor = new ort.Tensor(
          "int64",
          BigInt64Array.from(paddedTokens),
          [1, paddedTokens.length],
        );

        console.log(inputTensor);

        // We generate our style tensor from the first token in the encoded tokens
        const ref_s = new ort.Tensor(
          "float32",
          voiceData?.slice(
            encodedTokens.length * 256,
            (encodedTokens.length + 1) * 256,
          )!,
          [1, 256],
        );

        const feeds = {
          "input_ids": inputTensor,
          "style": ref_s,
          "speed": new ort.Tensor("float32", new Float32Array([1.0]), [1]),
        };

        const results = await context.ortSession.run(feeds);
        const audio = results[Object.keys(results)[0]].data as Float32Array;
        audioManager.cacheAudioData(encodedTokens, audio, voice?.name!, input);

        console.log("TypeScript tokens:", paddedTokens);
        console.log("TypeScript ref_s shape:", ref_s.dims);
        console.log("TypeScript ref_s values:", ref_s.data);
        console.log("TypeScript audio shape:", audio?.length);

        console.log(audioManager.getCache());

        setInferenceResult(`Inference complete!`);
      }
    } catch (error) {
      setInferenceResult(`Error during inference: ${error.message}`);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="p-4">
      <h1 className="text-2xl mb-4">Local Kokoro-82M Speech Synthesis</h1>
      <textarea
        placeholder="Enter your message..."
        value={input}
        onInput={handleInputChange}
        className="w-full h-24 mb-4 p-2 border rounded"
      />
      <button
        onClick={createTensorAndInfer}
        disabled={isLoading || input.length === 0}
        className="bg-blue-500 text-white px-4 py-2 rounded disabled:bg-gray-300"
      >
        {isLoading ? "Processing..." : "Run Inference"}
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
