import * as esbuild from "https://deno.land/x/esbuild@v0.20.1/mod.js";
import { denoPlugins } from "jsr:@luca/esbuild-deno-loader@0.9";

async function build() {
  // Configure esbuild
  await esbuild.build({
    plugins: [...denoPlugins()],
    entryPoints: ["src/main.ts"],
    outdir: "dist/",
    bundle: true,
    platform: "browser",
    format: "esm",
    target: "esnext",
    minify: true,
    sourcemap: true,
    treeShaking: true,
  });

  // Copy all .wasm files
  const sourceDir = "./node_modules/onnxruntime-web/dist/"; // Adjust the source directory
  const destinationDir = "./dist/";

  try {
    // Ensure the destination directory exists
    await Deno.mkdir(destinationDir, { recursive: true });

    // Read files from the source directory
    for await (const file of Deno.readDir(sourceDir)) {
      if (file.isFile && file.name.endsWith(".wasm")) {
        const sourceFile = `${sourceDir}/${file.name}`;
        const destinationFile = `${destinationDir}/${file.name}`;

        // Copy the file
        await Deno.copyFile(sourceFile, destinationFile);
        console.log(`Copied ${sourceFile} to ${destinationFile}`);
      }
    }
  } catch (error) {
    console.error(`Failed to copy .wasm files: ${error.message}`);
  }

  // Stop esbuild
  esbuild.stop();
}

build();
