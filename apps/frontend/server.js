import { createReadStream, existsSync } from "node:fs";
import { stat } from "node:fs/promises";
import { extname, join, normalize } from "node:path";
import { createServer } from "node:http";

const port = process.env.PORT || 8080;
const distDir = join(process.cwd(), "dist");
const mimeTypes = {
  ".css": "text/css; charset=utf-8",
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".png": "image/png",
  ".svg": "image/svg+xml",
  ".webp": "image/webp"
};

function getFilePath(url = "/") {
  const pathname = decodeURIComponent(url.split("?")[0]);
  const normalizedPath = normalize(pathname).replace(/^(\.\.[/\\])+/, "");
  const candidate = join(distDir, normalizedPath);

  if (!candidate.startsWith(distDir)) {
    return join(distDir, "index.html");
  }

  return candidate;
}

async function resolveFile(url) {
  const filePath = getFilePath(url);

  try {
    const stats = await stat(filePath);
    return stats.isFile() ? filePath : join(distDir, "index.html");
  } catch {
    return join(distDir, "index.html");
  }
}

createServer(async (req, res) => {
  const filePath = await resolveFile(req.url);

  if (!existsSync(filePath)) {
    res.writeHead(404);
    res.end("Not found");
    return;
  }

  res.writeHead(200, {
    "Content-Type": mimeTypes[extname(filePath)] || "application/octet-stream"
  });
  createReadStream(filePath).pipe(res);
}).listen(port);
