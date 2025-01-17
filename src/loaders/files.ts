import { FetchedFile } from "../types.ts";

export class Fetcher {
  static async verifyChecksum(
    data: ArrayBuffer,
    expectedSha256?: string,
  ): Promise<boolean> {
    if (!expectedSha256) {
      console.log("No checksum provided, skipping verification");
      return true;
    }

    const hashBuffer = await crypto.subtle.digest("SHA-256", data);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    const hashHex = hashArray.map((b) => b.toString(16).padStart(2, "0")).join(
      "",
    );
    console.log(`Checksum: ${hashHex}`);
    console.log(`Expected: ${expectedSha256}`);
    return hashHex === expectedSha256;
  }

  // Given a file, fetch it from the URL
  static async fetchFile(info: FetchedFile): Promise<ArrayBuffer> {
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
          if (loadedBytes % 128 === 0) {
            console.log(
              `Loaded ${loadedBytes}/${totalBytes} bytes (${progress}%)`,
            );
          }
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

      console.log(
        `Downloaded ${info.filename}: (${weightData.byteLength} bytes)`,
      );

      // Verify checksum if provided
      if (!(await Fetcher.verifyChecksum(weightData.buffer, info.sha256))) {
        throw new Error("Checksum verification failed");
      }

      return weightData.buffer;
    } catch (error) {
      console.error(`Error downloading ${info.filename}:`, error);
      throw error;
    }
  }
}
