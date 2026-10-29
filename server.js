const http = require("http");
const fs = require("fs");
const path = require("path");

const root = __dirname;
const args = process.argv.slice(2);
const portFlag = args.indexOf("--port");
const hostFlag = args.indexOf("--host");
const port = Number(portFlag >= 0 ? args[portFlag + 1] : process.env.PORT || 7100);
const host = hostFlag >= 0 && args[hostFlag + 1] && !args[hostFlag + 1].startsWith("--") ? args[hostFlag + 1] : "127.0.0.1";
const mime = { ".html": "text/html; charset=utf-8", ".css": "text/css; charset=utf-8", ".js": "text/javascript; charset=utf-8", ".json": "application/json; charset=utf-8", ".svg": "image/svg+xml" };

http.createServer((req, res) => {
  const pathname = decodeURIComponent(new URL(req.url, "http://localhost").pathname);
  const filePath = path.resolve(root, `.${pathname === "/" ? "/index.html" : pathname}`);
  if (!filePath.startsWith(root + path.sep)) {
    res.writeHead(403); res.end("Forbidden"); return;
  }
  fs.readFile(filePath, (error, content) => {
    if (error) { res.writeHead(404, { "Content-Type": "text/plain; charset=utf-8" }); res.end("文件未找到"); return; }
    res.writeHead(200, { "Content-Type": mime[path.extname(filePath)] || "application/octet-stream", "Cache-Control": "no-cache" });
    res.end(content);
  });
}).listen(port, host, () => console.log(`利率学习室：http://localhost:${port}/`));
