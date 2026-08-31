/**
 * 本机 LLM sidecar。不改 vite.config.js，只解决 localhost CORS。
 * 用法：npm run proxy:llm
 */
import http from "node:http";
import https from "node:https";

const PORT = Number(process.env.RPG_PROXY_PORT || 8787);
const TARGET = (process.env.RPG_PROXY_TARGET || "https://api.deepseek.com").replace(/\/$/, "");
const targetUrl = new URL(TARGET);

function corsHeaders() {
  return {
    "access-control-allow-origin": "*",
    "access-control-allow-methods": "GET,POST,PUT,PATCH,DELETE,OPTIONS",
    "access-control-allow-headers": "content-type, authorization, m-traceid",
    "access-control-max-age": "86400",
  };
}

function proxyPath(reqUrl) {
  const incoming = new URL(reqUrl || "/", "http://127.0.0.1");
  const basePath = targetUrl.pathname.replace(/\/$/, "");
  return `${basePath}${incoming.pathname}${incoming.search}`;
}

const server = http.createServer((req, res) => {
  if (req.method === "OPTIONS") {
    res.writeHead(204, corsHeaders());
    res.end();
    return;
  }

  const headers = { ...req.headers, host: targetUrl.host };
  delete headers.connection;
  delete headers.origin;
  delete headers.referer;

  const proxyReq = https.request(
    {
      hostname: targetUrl.hostname,
      port: targetUrl.port || 443,
      path: proxyPath(req.url),
      method: req.method,
      headers,
      timeout: 60000,
    },
    (proxyRes) => {
      res.writeHead(proxyRes.statusCode || 502, {
        ...proxyRes.headers,
        ...corsHeaders(),
      });
      proxyRes.pipe(res);
    },
  );

  proxyReq.on("timeout", () => {
    proxyReq.destroy();
    if (!res.headersSent) res.writeHead(504, corsHeaders());
    res.end(JSON.stringify({ error: "llm proxy timeout" }));
  });

  proxyReq.on("error", (err) => {
    if (!res.headersSent) res.writeHead(502, corsHeaders());
    res.end(JSON.stringify({ error: err.message || "llm proxy failed" }));
  });

  req.pipe(proxyReq);
});

server.listen(PORT, "127.0.0.1", () => {
  console.log(`[llm-proxy] http://127.0.0.1:${PORT} -> ${TARGET}`);
});
