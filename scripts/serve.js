import http from "node:http";
import { readFile, stat } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const port = Number(process.env.PORT ?? 4173);
const types = { ".html": "text/html; charset=utf-8", ".js": "text/javascript; charset=utf-8", ".css": "text/css; charset=utf-8", ".json": "application/json", ".webmanifest": "application/manifest+json", ".png": "image/png", ".mp3": "audio/mpeg" };

http.createServer(async (request, response) => {
  try {
    const urlPath = decodeURIComponent(new URL(request.url, `http://${request.headers.host}`).pathname);
    let target = path.resolve(root, `.${urlPath}`);
    if (!target.startsWith(root)) throw new Error("Invalid path");
    if ((await stat(target)).isDirectory()) target = path.join(target, "index.html");
    response.writeHead(200, { "Content-Type": types[path.extname(target)] ?? "application/octet-stream", "Cache-Control": "no-cache" });
    response.end(await readFile(target));
  } catch {
    response.writeHead(404, { "Content-Type": "text/plain; charset=utf-8" });
    response.end("Not found");
  }
}).listen(port, "0.0.0.0", () => console.log(`米妮单词诊断: http://localhost:${port}`));
