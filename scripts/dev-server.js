import { createServer } from "node:http";
import { createReadStream, existsSync, statSync } from "node:fs";
import { extname, join, normalize } from "node:path";
import { fileURLToPath } from "node:url";
import { dirname } from "node:path";

const root = dirname(dirname(fileURLToPath(import.meta.url)));
const base = join(root, "docs");
const port = Number(process.env.PORT || 4173);
const host = process.env.HOST || "127.0.0.1";

const types = {
  ".css": "text/css; charset=utf-8",
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".svg": "image/svg+xml; charset=utf-8",
  ".png": "image/png"
};

const server = createServer((request, response) => {
  const url = new URL(request.url || "/", `http://localhost:${port}`);
  let pathname = decodeURIComponent(url.pathname);
  let file = join(base, normalize(pathname));

  if (existsSync(file) && statSync(file).isDirectory()) {
    file = join(file, "index.html");
  }
  if (!existsSync(file) && !extname(file)) {
    file = join(file, "index.html");
  }
  if (!existsSync(file)) {
    response.writeHead(404, { "content-type": "text/plain; charset=utf-8" });
    response.end("not found");
    return;
  }

  response.writeHead(200, { "content-type": types[extname(file)] || "application/octet-stream" });
  createReadStream(file).pipe(response);
});

server.listen(port, host, () => {
  console.log(`when-vod dev server: http://${host}:${port}`);
});
