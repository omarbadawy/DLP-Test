import express from "express";
import fileUpload from "express-fileupload";
import { WebSocketServer } from "ws";
import path from "path";
import { fileURLToPath } from "url";

const app = express();
const PORT = process.env.PORT || 3000;

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(fileUpload());
app.use(express.static(path.join(__dirname, "public")));

// Universal API endpoint
app.all("/api/:method", (req, res) => {
  console.log("📩 Request received:");
  console.log(" Method:", req.method);
  console.log(" Path:", req.originalUrl);
  console.log(" Query:", req.query);
  console.log(" Body:", req.body);

  res.json({
    message: "Echo from server ✅",
    method: req.method,
    path: req.originalUrl,
    headers: req.headers,
    body: req.body,
    query: req.query,
  });
});

// File upload with POST
app.post("/upload", (req, res) => {
  console.log("📂 File upload POST request");
  if (!req.files || Object.keys(req.files).length === 0) {
    return res.status(400).json({ error: "No files uploaded" });
  }
  console.log(" Uploaded files:", Object.keys(req.files));
  res.json({
    message: "File uploaded successfully ✅",
    files: Object.keys(req.files),
  });
});

// File upload via GET (base64 in query)
app.get("/upload-get", (req, res) => {
  const { filename, data } = req.query;
  console.log("📂 File upload GET request");
  if (!filename || !data) {
    return res.status(400).json({ error: "Missing filename or data" });
  }
  console.log(" Uploaded file:", filename, " size:", Buffer.from(data, "base64").length);
  res.json({
    message: "File uploaded successfully via GET ✅",
    filename,
    size: Buffer.from(data, "base64").length,
  });
});

// Start server
const server = app.listen(PORT, () => {
  console.log(`✅ Server running at http://localhost:${PORT}`);
});

// WebSocket
const wss = new WebSocketServer({ server });

wss.on("connection", (ws) => {
  console.log("🔗 WebSocket connected");

  ws.on("message", (msg) => {
    try {
      const data = JSON.parse(msg);

      if (data.type === "text") {
        console.log("💬 WS Text:", data.content);
        ws.send(JSON.stringify({ echo: data.content }));
      } else if (data.type === "file") {
        console.log("📂 WS File:", data.filename);
        ws.send(JSON.stringify({ message: `File "${data.filename}" uploaded successfully ✅` }));
      }
    } catch (e) {
      console.log("⚠️ WS Error parsing message:", e.message);
      ws.send("ERR: Invalid message format");
    }
  });

  ws.on("close", () => console.log("❌ WebSocket disconnected"));
});
