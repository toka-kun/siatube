import express from "express";
import path from "path";
import { fileURLToPath } from "url";
import { Readable } from "stream";

const app = express();
const PORT = process.env.PORT || 5000;

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const distPath = path.join(__dirname, "../client/dist"); 
const PROXY_BASE = "https://siawaseok.duckdns.org";

app.use(express.json({ limit: "10mb" }));
app.use(express.urlencoded({ extended: true }));

app.use(["/exec", "/api"], async (req, res) => {
  const targetUrl = PROXY_BASE + req.originalUrl;
  console.log(`[PROXY] ${req.method} ${targetUrl}`);

  try {
    const headers = {};
    for (const [key, value] of Object.entries(req.headers)) {
      if (key.toLowerCase() === "host") continue;
      headers[key] = value;
    }

    const options = {
      method: req.method,
      headers: headers,
      redirect: "manual",
    };

    if (req.method !== "GET" && req.method !== "HEAD") {
      if (req.body && Object.keys(req.body).length > 0) {
        options.body = JSON.stringify(req.body);
        if (!headers["content-type"]) {
          headers["content-type"] = "application/json";
        }
      }
    }

    const response = await fetch(targetUrl, options);
    res.status(response.status);

    response.headers.forEach((value, key) => {
      res.setHeader(key, value);
    });

    if (response.body) {
      Readable.fromWeb(response.body).pipe(res);
    } else {
      res.end();
    }

    console.log(`[PROXY OK] ${response.status}`);
  } catch (err) {
    console.error("[PROXY ERROR]", err);
    res.status(500).json({
      error: "proxy_error",
      message: String(err),
    });
  }
});

app.use(express.static(distPath));

app.get("*", (req, res) => {
  res.sendFile(path.join(distPath, "index.html"));
});

app.listen(PORT, () => {
  console.log(`✅ Server running`);
  console.log(`http://localhost:${PORT}`);
});
