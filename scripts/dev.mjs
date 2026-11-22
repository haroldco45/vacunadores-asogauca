// Servidor local de pruebas: node scripts/dev.mjs  (guarda datos en ./.datos-locales)
import http from "node:http";
import fs from "node:fs/promises";
import path from "node:path";
process.env.LOCAL_BLOBS = process.env.LOCAL_BLOBS || path.resolve(".datos-locales");
const api = (await import("../netlify/functions/api.mjs")).default;
const tipos = { ".html": "text/html", ".js": "text/javascript", ".css": "text/css", ".json": "application/json", ".webmanifest": "application/manifest+json", ".jpg": "image/jpeg", ".png": "image/png", ".svg": "image/svg+xml" };
http.createServer(async (req, res) => {
  const url = new URL(req.url, "http://x");
  if (url.pathname === "/api") {
    let body = ""; for await (const c of req) body += c;
    const r = await api(new Request("http://x/api", { method: req.method, body: req.method === "POST" ? body : undefined }));
    res.writeHead(r.status, Object.fromEntries(r.headers)); res.end(await r.text()); return;
  }
  let f = path.join(".", decodeURIComponent(url.pathname));
  if (url.pathname.endsWith("/")) f = path.join(f, "index.html");
  try { const d = await fs.readFile(f); res.writeHead(200, { "content-type": tipos[path.extname(f)] || "application/octet-stream" }); res.end(d); }
  catch { res.writeHead(404); res.end("no"); }
}).listen(process.env.PORT || 8888, () => console.log("http://localhost:" + (process.env.PORT || 8888)));
