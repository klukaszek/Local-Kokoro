import { serve } from "https://deno.land/std@0.185.0/http/server.ts";
import { extname } from "https://deno.land/std@0.185.0/path/mod.ts";

const mimeTypes: Record<string, string> = {
  ".html": "text/html",
  ".js": "application/javascript",
  ".ts": "application/javascript", // Serve TypeScript files as JavaScript
  ".css": "text/css",
  ".json": "application/json",
  ".wasm": "application/wasm",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".svg": "image/svg+xml",
};

serve(async (req) => {
  const url = new URL(req.url);
  let path = `.${url.pathname}`;
  if (path === "./") path = "./index.html";

  try {
    const file = await Deno.readFile(path);
    const ext = extname(path);
    const contentType = mimeTypes[ext] || "application/octet-stream";

    return new Response(file, {
      headers: { "Content-Type": contentType },
    });
  } catch (err) {
    console.error("Error serving file:", err);
    return new Response("File not found", { status: 404 });
  }
});

